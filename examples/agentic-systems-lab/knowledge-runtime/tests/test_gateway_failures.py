import asyncio

import asyncpg
import pytest

from knowledge_runtime.workflow import ApprovalInput, FollowupInput


async def test_proposal_replay_overlapping_approval_has_consistent_lock_order(
    workflow, database, principal, reviewer, customer
):
    request = FollowupInput(customer_id=customer, business_key="overlap", message="Booking?")
    proposal = await workflow.propose(principal, request)
    review = await workflow.review(reviewer, proposal["proposal_id"])

    async def approve():
        return await workflow.decide(
            reviewer,
            proposal["proposal_id"],
            ApprovalInput(decision="approve", request_hash=review["request_hash"]),
        )

    results = await asyncio.gather(
        *(approve() if i % 2 else workflow.propose(principal, request) for i in range(20)),
        return_exceptions=True,
    )
    assert not any(isinstance(r, Exception) for r in results), results
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 1


async def test_empty_knowledge_does_not_produce_unfounded_draft(gateway, principal, customer):
    result = await gateway.call(
        principal, "draft_followup", {"customer_id": customer, "topic": "booking"}
    )
    assert not result.ok and result.code == "knowledge_not_found"


@pytest.mark.parametrize(
    "error,code",
    [
        (asyncpg.InterfaceError("synthetic unavailable"), "database_unavailable"),
        (RuntimeError("secret-shaped vendor message"), "internal_error"),
    ],
)
async def test_gateway_failure_contract_redacts_dependency_errors(
    gateway, principal, customer, monkeypatch, error, code
):
    async def fail(*args):
        raise error

    monkeypatch.setattr(gateway.workflow, "customer", fail)
    result = await gateway.call(principal, "search_customer", {"customer_id": customer})
    assert not result.ok and result.code == code
    assert "secret-shaped" not in str(result.model_dump())


async def test_native_client_cannot_replace_registered_execution_target(
    gateway, principal, customer
):
    result = await gateway.call(principal, "get_pipeline_status", {"customer_id": customer})
    assert result.code == "invalid_parameters"
