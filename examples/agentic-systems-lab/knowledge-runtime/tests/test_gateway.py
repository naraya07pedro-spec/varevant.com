import asyncio
import json

import asyncpg
import pytest
from conftest import READER_TOKEN, REVIEWER_TOKEN

from knowledge_runtime.domain import BoundaryError, IngestDocument
from knowledge_runtime.security import Principal
from knowledge_runtime.workflow import ApprovalInput, FollowupInput


def followup(customer, key="followup-1", message="Would you like a booking?"):
    return FollowupInput(customer_id=customer, business_key=key, message=message)


async def test_registered_read_tools_and_grounded_draft(gateway, retrieval, principal, customer):
    saved = await retrieval.ingest(
        principal,
        IngestDocument(source_key="booking", version=1, text="Booking uses the verified calendar."),
    )
    read = await gateway.call(principal, "search_customer", {"customer_id": customer})
    assert read.ok and read.data["customer_id"] == customer
    assert "recipient" not in read.data
    status = await gateway.call(
        principal, "get_document_status", {"document_id": saved["document_id"]}
    )
    assert status.ok and status.data["version"] == 1
    draft = await gateway.call(
        principal, "draft_followup", {"customer_id": customer, "topic": "booking calendar"}
    )
    assert draft.ok and draft.data["citations"][0]["source_key"] == "booking"
    assert draft.data["external_effect"] == "none"
    counts = await gateway.call(principal, "get_pipeline_status", {})
    assert counts.ok and counts.data["ready_handoffs"] == 0


@pytest.mark.parametrize(
    "field,value",
    [
        ("tenant", "other"),
        ("recipient", "attacker@example.invalid"),
        ("authority", "admin"),
        ("credential", "never-log"),
        ("url", "http://internal.invalid"),
        ("approved", True),
        ("approval_status", "APPROVED"),
    ],
)
async def test_model_cannot_choose_server_authority_or_target(
    gateway, database, principal, customer, field, value
):
    params = followup(customer).model_dump()
    params[field] = value
    result = await gateway.call(principal, "request_followup_send", params)
    assert not result.ok and result.code == "invalid_parameters"
    assert await database.fetchval("SELECT count(*) FROM followup_proposals") == 0
    assert value not in json.dumps(result.model_dump()) if isinstance(value, str) else True


async def test_default_deny_unknown_tool_and_missing_permission(gateway, database, principal):
    unknown = await gateway.call(principal, "arbitrary_http", {"url": "http://internal.invalid"})
    assert unknown.code == "tool_not_allowed"
    denied = Principal(
        tenant="demo", subject="reader", permissions=["read"], tools=["request_followup_send"]
    )
    result = await gateway.call(denied, "request_followup_send", {})
    assert result.code == "permission_denied" and gateway.exposed(denied) == []
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 0


@pytest.mark.parametrize("params", [{}, {"customer_id": "../escape"}, {"customer_id": True}])
async def test_malformed_registered_tool_parameters(gateway, principal, params):
    assert (await gateway.call(principal, "search_customer", params)).code == "invalid_parameters"


async def test_proposal_requires_separate_human_and_exact_content_hash(
    workflow, database, principal, reviewer, customer
):
    proposed = await workflow.propose(principal, followup(customer))
    assert proposed["state"] == "PENDING" and proposed["external_effect"] == "not_dispatched"
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 0
    review = await workflow.review(reviewer, proposed["proposal_id"])
    assert review["target_recipient"] == "customer@example.invalid"
    with pytest.raises(BoundaryError, match="permission_denied"):
        await workflow.decide(
            principal,
            proposed["proposal_id"],
            ApprovalInput(decision="approve", request_hash=review["request_hash"]),
        )
    with pytest.raises(BoundaryError, match="approval_content_mismatch"):
        await workflow.decide(
            reviewer,
            proposed["proposal_id"],
            ApprovalInput(decision="approve", request_hash="0" * 64),
        )
    result = await workflow.decide(
        reviewer,
        proposed["proposal_id"],
        ApprovalInput(decision="approve", request_hash=review["request_hash"]),
    )
    assert result.ok and result.data["state"] == "APPROVED"
    outbox = await database.fetchrow("SELECT * FROM workflow_outbox")
    assert (
        outbox["state"] == "READY"
        and json.loads(outbox["payload"])["recipient"] == "customer@example.invalid"
    )


async def test_self_approval_denied_even_with_approval_permission(
    workflow, principal, reviewer, customer
):
    proposed = await workflow.propose(principal, followup(customer))
    review = await workflow.review(reviewer, proposed["proposal_id"])
    self_reviewer = principal.model_copy(update={"permissions": ["approve"]})
    with pytest.raises(BoundaryError, match="self_approval_denied"):
        await workflow.decide(
            self_reviewer,
            proposed["proposal_id"],
            ApprovalInput(decision="approve", request_hash=review["request_hash"]),
        )


@pytest.mark.parametrize(
    "change",
    [
        "revision=revision+1",
        "recipient='changed@example.invalid'",
        "suppressed=true",
        "verified=false",
    ],
)
async def test_target_drift_invalidates_approval(
    workflow, database, principal, reviewer, customer, change
):
    proposed = await workflow.propose(principal, followup(customer))
    review = await workflow.review(reviewer, proposed["proposal_id"])
    await database.execute("UPDATE customers SET " + change)
    result = await workflow.decide(
        reviewer,
        proposed["proposal_id"],
        ApprovalInput(decision="approve", request_hash=review["request_hash"]),
    )
    assert not result.ok and result.code == "target_changed"
    assert await database.fetchval("SELECT state FROM followup_proposals") == "REJECTED"
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 0


async def test_expired_or_rejected_proposals_do_not_enqueue(
    workflow, database, principal, reviewer, customer
):
    proposed = await workflow.propose(principal, followup(customer))
    review = await workflow.review(reviewer, proposed["proposal_id"])
    await database.execute(
        "UPDATE followup_proposals SET expires_at=clock_timestamp()-interval '1 second'"
    )
    result = await workflow.decide(
        reviewer,
        proposed["proposal_id"],
        ApprovalInput(decision="approve", request_hash=review["request_hash"]),
    )
    assert result.code == "approval_expired"
    proposed2 = await workflow.propose(principal, followup(customer, key="second"))
    review2 = await workflow.review(reviewer, proposed2["proposal_id"])
    result = await workflow.decide(
        reviewer,
        proposed2["proposal_id"],
        ApprovalInput(decision="reject", request_hash=review2["request_hash"]),
    )
    assert result.ok and result.data["state"] == "REJECTED"
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 0


async def test_concurrent_replay_reserves_one_proposal_and_one_handoff(
    workflow, database, principal, reviewer, customer
):
    proposals = await asyncio.gather(
        *(workflow.propose(principal, followup(customer)) for _ in range(12))
    )
    assert len({p["proposal_id"] for p in proposals}) == 1
    assert await database.fetchval("SELECT count(*) FROM followup_proposals") == 1
    review = await workflow.review(reviewer, proposals[0]["proposal_id"])
    results = await asyncio.gather(
        *(
            workflow.decide(
                reviewer,
                review["proposal_id"],
                ApprovalInput(decision="approve", request_hash=review["request_hash"]),
            )
            for _ in range(6)
        )
    )
    assert all(r.ok for r in results)
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 1
    with pytest.raises(BoundaryError, match="idempotency_conflict"):
        await workflow.propose(principal, followup(customer, message="Changed body"))


async def test_failure_between_approval_and_handoff_rolls_back_both(
    workflow, database, principal, reviewer, customer
):
    proposed = await workflow.propose(principal, followup(customer))
    review = await workflow.review(reviewer, proposed["proposal_id"])
    await database.execute("""
        CREATE FUNCTION fail_handoff_test() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'synthetic handoff persistence failure'; END; $$;
        CREATE TRIGGER fail_handoff BEFORE INSERT ON workflow_outbox
        FOR EACH ROW EXECUTE FUNCTION fail_handoff_test();
    """)
    try:
        with pytest.raises(asyncpg.PostgresError):
            await workflow.decide(
                reviewer,
                review["proposal_id"],
                ApprovalInput(decision="approve", request_hash=review["request_hash"]),
            )
        assert await database.fetchval("SELECT state FROM followup_proposals") == "PENDING"
        assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 0
    finally:
        await database.execute(
            "DROP TRIGGER fail_handoff ON workflow_outbox; DROP FUNCTION fail_handoff_test()"
        )
    result = await workflow.decide(
        reviewer,
        review["proposal_id"],
        ApprovalInput(decision="approve", request_hash=review["request_hash"]),
    )
    assert result.ok and await database.fetchval("SELECT count(*) FROM workflow_outbox") == 1


async def test_cross_tenant_target_and_approval_are_not_found(
    workflow, principal, other_principal, reviewer, customer
):
    with pytest.raises(BoundaryError, match="not_found"):
        await workflow.propose(other_principal, followup(customer))
    proposed = await workflow.propose(principal, followup(customer))
    other_reviewer = reviewer.model_copy(update={"tenant": "other"})
    with pytest.raises(BoundaryError, match="not_found"):
        await workflow.review(other_reviewer, proposed["proposal_id"])


@pytest.mark.parametrize("change", ["suppressed=true", "verified=false", "recipient='invalid'"])
async def test_ineligible_server_target_rejected(workflow, database, principal, customer, change):
    await database.execute("UPDATE customers SET " + change)
    with pytest.raises(BoundaryError, match="target_not_eligible"):
        await workflow.propose(principal, followup(customer))


async def test_http_tool_and_human_approval_contract(client, database, customer):
    params = followup(customer).model_dump()
    result = await client.post("/tools/request_followup_send", json={"parameters": params})
    assert result.status_code == 200 and result.json()["code"] == "approval_required"
    proposal_id = result.json()["data"]["proposal_id"]
    assert (await client.get("/approvals/" + proposal_id)).status_code == 403
    human = {"Authorization": "Bearer " + REVIEWER_TOKEN}
    review = (await client.get("/approvals/" + proposal_id, headers=human)).json()
    approved = await client.post(
        "/approvals/" + proposal_id,
        json={"decision": "approve", "request_hash": review["request_hash"]},
        headers=human,
    )
    assert approved.status_code == 200 and approved.json()["data"]["state"] == "APPROVED"
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 1
    reader = {"Authorization": "Bearer " + READER_TOKEN}
    assert [t["name"] for t in (await client.get("/tools", headers=reader)).json()] == [
        "search_knowledge"
    ]
    assert (
        await client.post(
            "/tools/request_followup_send", json={"parameters": params}, headers=reader
        )
    ).status_code == 403


async def test_audit_records_safe_tool_outcomes_without_model_inputs(
    gateway, database, principal, customer, caplog
):
    import logging

    caplog.set_level(logging.INFO, logger="knowledge.audit")
    await gateway.call(
        principal,
        "request_followup_send",
        followup(customer, message="Sensitive body with private-data@example.invalid").model_dump(),
    )
    await gateway.call(principal, "arbitrary_private_tool", {"credential": "private-data"})
    rows = str([dict(r) for r in await database.fetch("SELECT * FROM audit_events")])
    assert "private-data" not in caplog.text + rows
    assert "arbitrary_private_tool" not in caplog.text + rows
