from __future__ import annotations

import json
import re
from typing import Any, Literal

import asyncpg
from pydantic import Field

from knowledge_runtime.domain import BoundaryError, StrictModel, digest
from knowledge_runtime.observability import Audit
from knowledge_runtime.security import Principal


class CustomerInput(StrictModel):
    customer_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_-]+$")


class DraftInput(CustomerInput):
    topic: str = Field(min_length=1, max_length=160)


class FollowupInput(CustomerInput):
    message: str = Field(min_length=1, max_length=2000)
    business_key: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_.-]+$")


class ApprovalInput(StrictModel):
    decision: Literal["approve", "reject"]
    request_hash: str = Field(pattern=r"^[a-f0-9]{64}$")


class GatewayReply(StrictModel):
    ok: bool
    code: str
    data: dict[str, Any] | None = None
    http_status: int = Field(default=200, exclude=True)


class Workflow:
    def __init__(self, database: asyncpg.Pool[Any], audit: Audit) -> None:
        self.database = database
        self.audit = audit

    @staticmethod
    def validate_target(row: asyncpg.Record | None) -> None:
        if row is None:
            raise BoundaryError("not_found", 404)
        if row["suppressed"] or not row["verified"]:
            raise BoundaryError("target_not_eligible", 409)
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", row["recipient"]):
            raise BoundaryError("target_not_eligible", 409)

    async def customer(self, principal: Principal, customer_id: str) -> dict[str, Any]:
        principal.require("read")
        row = await self.database.fetchrow(
            """
            SELECT customer_id,display_name,revision,verified,suppressed FROM customers
            WHERE tenant=$1 AND customer_id=$2
        """,
            principal.tenant,
            customer_id,
        )
        if row is None:
            raise BoundaryError("not_found", 404)
        return dict(row)

    async def pipeline(self, principal: Principal) -> dict[str, Any]:
        principal.require("read")
        pending = await self.database.fetchval(
            "SELECT count(*) FROM followup_proposals WHERE tenant=$1 AND state='PENDING'",
            principal.tenant,
        )
        ready = await self.database.fetchval(
            "SELECT count(*) FROM workflow_outbox WHERE tenant=$1",
            principal.tenant,
        )
        return {
            "pending_approvals": pending,
            "ready_handoffs": ready,
            "delivery_boundary": "No external message dispatcher in this reference",
        }

    async def propose(self, principal: Principal, request: FollowupInput) -> dict[str, Any]:
        principal.require("propose")
        proposal_id = digest([principal.tenant, request.business_key])
        async with self.database.acquire() as connection, connection.transaction():
            target = await connection.fetchrow(
                "SELECT * FROM customers WHERE tenant=$1 AND customer_id=$2 FOR UPDATE",
                principal.tenant,
                request.customer_id,
            )
            self.validate_target(target)
            assert target is not None
            fingerprint = digest(
                [
                    principal.tenant,
                    request.customer_id,
                    target["revision"],
                    target["recipient"],
                    request.message,
                    principal.subject,
                ]
            )
            await connection.execute(
                """
                INSERT INTO followup_proposals(tenant,proposal_id,business_key,customer_id,
                  requester,request_hash,target_revision,target_recipient,message,state)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING')
                ON CONFLICT(tenant,business_key) DO NOTHING
            """,
                principal.tenant,
                proposal_id,
                request.business_key,
                request.customer_id,
                principal.subject,
                fingerprint,
                target["revision"],
                target["recipient"],
                request.message,
            )
            row = await connection.fetchrow(
                "SELECT * FROM followup_proposals WHERE tenant=$1 AND proposal_id=$2",
                principal.tenant,
                proposal_id,
            )
            assert row is not None
            if row["request_hash"] != fingerprint:
                raise BoundaryError("idempotency_conflict", 409)
        return {
            "proposal_id": proposal_id,
            "state": row["state"],
            "external_effect": "not_dispatched",
        }

    async def review(self, principal: Principal, proposal_id: str) -> dict[str, Any]:
        principal.require("approve")
        row = await self.database.fetchrow(
            """
            SELECT proposal_id,customer_id,requester,request_hash,target_revision,
              target_recipient,message,state,expires_at::text
            FROM followup_proposals WHERE tenant=$1 AND proposal_id=$2
        """,
            principal.tenant,
            proposal_id,
        )
        if row is None:
            raise BoundaryError("not_found", 404)
        return dict(row)

    async def decide(
        self,
        principal: Principal,
        proposal_id: str,
        request: ApprovalInput,
    ) -> GatewayReply:
        try:
            result = await self._decide(principal, proposal_id, request)
        except BoundaryError as exc:
            await self.audit.record(principal, "approval", exc.code)
            raise
        outcome = (
            str(result.data["state"]).lower()
            if result.code == "ok" and result.data
            else result.code
        )
        await self.audit.record(principal, "approval", outcome)
        return result

    async def _decide(
        self,
        principal: Principal,
        proposal_id: str,
        request: ApprovalInput,
    ) -> GatewayReply:
        principal.require("approve")
        async with self.database.acquire() as connection, connection.transaction():
            identity = await connection.fetchrow(
                "SELECT customer_id FROM followup_proposals WHERE tenant=$1 AND proposal_id=$2",
                principal.tenant,
                proposal_id,
            )
            if identity is None:
                raise BoundaryError("not_found", 404)
            # Same lock order as proposal admission: customer, then proposal/outbox.
            target = await connection.fetchrow(
                "SELECT * FROM customers WHERE tenant=$1 AND customer_id=$2 FOR UPDATE",
                principal.tenant,
                identity["customer_id"],
            )
            proposal = await connection.fetchrow(
                """
                SELECT *, expires_at<=clock_timestamp() AS expired FROM followup_proposals
                WHERE tenant=$1 AND proposal_id=$2 FOR UPDATE
            """,
                principal.tenant,
                proposal_id,
            )
            if proposal is None:
                raise BoundaryError("not_found", 404)
            if proposal["customer_id"] != identity["customer_id"]:
                raise BoundaryError("approval_target_mismatch", 409)
            if principal.subject == proposal["requester"]:
                raise BoundaryError("self_approval_denied", 403)
            if request.request_hash != proposal["request_hash"]:
                raise BoundaryError("approval_content_mismatch", 409)
            if proposal["state"] != "PENDING":
                return GatewayReply(
                    ok=proposal["state"] == "APPROVED",
                    code="already_decided",
                    data={"state": proposal["state"]},
                )
            code = "ok"
            state = "APPROVED" if request.decision == "approve" else "REJECTED"
            if proposal["expired"]:
                state, code = "EXPIRED", "approval_expired"
            elif request.decision == "approve":
                assert target is not None
                if (
                    target["suppressed"]
                    or not target["verified"]
                    or target["revision"] != proposal["target_revision"]
                    or target["recipient"] != proposal["target_recipient"]
                ):
                    state, code = "REJECTED", "target_changed"
            await connection.execute(
                """
                UPDATE followup_proposals SET state=$3,reviewer=$4
                WHERE tenant=$1 AND proposal_id=$2
            """,
                principal.tenant,
                proposal_id,
                state,
                principal.subject,
            )
            if state == "APPROVED":
                # Durable local handoff only. A real sender is a separate authority boundary.
                payload = {
                    "schema_version": 1,
                    "recipient": proposal["target_recipient"],
                    "customer_id": proposal["customer_id"],
                    "message": proposal["message"],
                    "approval_hash": proposal["request_hash"],
                }
                await connection.execute(
                    """
                    INSERT INTO workflow_outbox(tenant,handoff_id,proposal_id,state,payload)
                    VALUES($1,$2,$2,'READY',$3::jsonb)
                """,
                    principal.tenant,
                    proposal_id,
                    json.dumps(payload),
                )
        return GatewayReply(
            ok=code == "ok",
            code=code,
            data={"state": state},
            http_status=200 if code == "ok" else 409,
        )
