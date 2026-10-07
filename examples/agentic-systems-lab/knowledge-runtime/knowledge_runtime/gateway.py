from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal, Protocol

import asyncpg
from pydantic import BaseModel, Field, ValidationError

from knowledge_runtime.domain import BoundaryError, SearchQuery, StrictModel
from knowledge_runtime.observability import Audit
from knowledge_runtime.retrieval import Retrieval
from knowledge_runtime.security import Principal
from knowledge_runtime.workflow import (
    CustomerInput,
    DraftInput,
    FollowupInput,
    GatewayReply,
    Workflow,
)


class DocumentStatusProvider(Protocol):
    async def status(self, principal: Principal, job_id: str) -> dict[str, Any]: ...


class DocumentStatus(StrictModel):
    document_id: str = Field(pattern=r"^[a-f0-9]{64}$")


class ExtractionStatus(StrictModel):
    job_id: str = Field(pattern=r"^[a-f0-9]{64}$")


class NoParameters(StrictModel):
    pass


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    schema: type[BaseModel]
    effect: Literal["read", "propose"]
    permission: str
    execute: Callable[[Principal, BaseModel], Awaitable[dict[str, Any]]]


class Gateway:
    def __init__(
        self,
        retrieval: Retrieval,
        workflow: Workflow,
        audit: Audit,
        documents: DocumentStatusProvider | None = None,
    ) -> None:
        self.retrieval = retrieval
        self.workflow = workflow
        self.audit = audit
        self.documents = documents
        self.registry = {
            spec.name: spec
            for spec in [
                ToolSpec(
                    "search_knowledge",
                    "Retrieve source-bound knowledge quotes",
                    SearchQuery,
                    "read",
                    "read",
                    self.search,
                ),
                ToolSpec(
                    "get_document_status",
                    "Read current source version/status",
                    DocumentStatus,
                    "read",
                    "read",
                    self.document_status,
                ),
                ToolSpec(
                    "get_extraction_status",
                    "Read validated document extraction status",
                    ExtractionStatus,
                    "read",
                    "read",
                    self.extraction_status,
                ),
                ToolSpec(
                    "search_customer",
                    "Read an existing tenant-bound customer",
                    CustomerInput,
                    "read",
                    "read",
                    self.customer,
                ),
                ToolSpec(
                    "get_pipeline_status",
                    "Read proposal and durable handoff counts",
                    NoParameters,
                    "read",
                    "read",
                    self.pipeline,
                ),
                ToolSpec(
                    "draft_followup",
                    "Draft from an existing customer and cited policy",
                    DraftInput,
                    "read",
                    "read",
                    self.draft,
                ),
                ToolSpec(
                    "request_followup_send",
                    "Create a target-bound proposal; never sends email",
                    FollowupInput,
                    "propose",
                    "propose",
                    self.propose,
                ),
            ]
        }

    def exposed(self, principal: Principal) -> list[ToolSpec]:
        return [
            spec
            for spec in self.registry.values()
            if spec.name in principal.tools and spec.permission in principal.permissions
        ]

    async def call(
        self, principal: Principal, name: str, parameters: dict[str, Any]
    ) -> GatewayReply:
        spec = self.registry.get(name)
        operation = "tool_" + name if spec else "tool_rejected"
        try:
            if spec is None or name not in principal.tools:
                raise BoundaryError("tool_not_allowed", 403)
            principal.require(spec.permission)
            request = spec.schema.model_validate(parameters)
            data = await spec.execute(principal, request)
            code = "ok"
            if spec.effect == "propose":
                code = (
                    "approval_required" if data.get("state") == "PENDING" else "proposal_recorded"
                )
            result = GatewayReply(ok=True, code=code, data=data)
        except ValidationError:
            result = GatewayReply(ok=False, code="invalid_parameters", http_status=422)
        except BoundaryError as exc:
            result = GatewayReply(ok=False, code=exc.code, http_status=exc.status)
        except (asyncpg.PostgresError, asyncpg.InterfaceError, OSError):
            result = GatewayReply(ok=False, code="database_unavailable", http_status=503)
        except Exception:
            result = GatewayReply(ok=False, code="internal_error", http_status=500)
        try:
            await self.audit.record(principal, operation, result.code)
        except (asyncpg.PostgresError, asyncpg.InterfaceError, OSError):
            return GatewayReply(ok=False, code="database_unavailable", http_status=503)
        return result

    async def search(self, principal: Principal, request: BaseModel) -> dict[str, Any]:
        assert isinstance(request, SearchQuery)
        return (await self.retrieval.search(principal, request)).model_dump()

    async def document_status(self, principal: Principal, request: BaseModel) -> dict[str, Any]:
        assert isinstance(request, DocumentStatus)
        return await self.retrieval.status(principal, request.document_id)

    async def extraction_status(self, principal: Principal, request: BaseModel) -> dict[str, Any]:
        assert isinstance(request, ExtractionStatus)
        if self.documents is None:
            raise BoundaryError("document_pipeline_unavailable", 503)
        return await self.documents.status(principal, request.job_id)

    async def customer(self, principal: Principal, request: BaseModel) -> dict[str, Any]:
        assert isinstance(request, CustomerInput)
        return await self.workflow.customer(principal, request.customer_id)

    async def pipeline(self, principal: Principal, request: BaseModel) -> dict[str, Any]:
        return await self.workflow.pipeline(principal)

    async def draft(self, principal: Principal, request: BaseModel) -> dict[str, Any]:
        assert isinstance(request, DraftInput)
        customer = await self.workflow.customer(principal, request.customer_id)
        result = await self.retrieval.search(principal, SearchQuery(query=request.topic, top_k=1))
        if not result.citations:
            raise BoundaryError("knowledge_not_found", 409)
        return {
            "customer_id": request.customer_id,
            "draft": f"Hello {customer['display_name']}, " + result.answer,
            "citations": [c.model_dump() for c in result.citations],
            "external_effect": "none",
        }

    async def propose(self, principal: Principal, request: BaseModel) -> dict[str, Any]:
        assert isinstance(request, FollowupInput)
        return await self.workflow.propose(principal, request)
