import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import timedelta

import pytest
from conftest import READER_TOKEN, WORKER_TOKEN
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from knowledge_runtime.domain import IngestDocument


@asynccontextmanager
async def session(settings, token):
    bindings = {key: p.model_dump() for key, p in settings.token_bindings.items()}
    server = StdioServerParameters(
        command=sys.executable,
        args=["-m", "knowledge_runtime.mcp_server"],
        env={
            **os.environ,
            "KNOWLEDGE_DATABASE_URL": settings.database_url,
            "KNOWLEDGE_TOKEN_BINDINGS": json.dumps(bindings),
            "KNOWLEDGE_MCP_TOKEN": token,
        },
    )
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=8)) as client:
            await client.initialize()
            yield client


@pytest.mark.wire
async def test_native_mcp_initialize_discover_and_read(
    settings, database, retrieval, principal, customer
):
    await retrieval.ingest(
        principal,
        IngestDocument(
            source_key="wire/booking",
            version=1,
            text="Plumbing booking requires calendar approval.",
        ),
    )
    async with session(settings, WORKER_TOKEN) as client:
        tools = (await client.list_tools()).tools
        names = {t.name for t in tools}
        assert {"search_knowledge", "request_followup_send", "search_customer"} <= names
        write = next(t for t in tools if t.name == "request_followup_send")
        assert write.annotations.readOnlyHint is False
        assert "tenant" not in write.inputSchema["properties"]
        result = await client.call_tool("search_knowledge", {"query": "plumbing calendar"})
        assert not result.isError
        assert result.structuredContent["data"]["citations"][0]["source_key"] == "wire/booking"
        customer_result = await client.call_tool("search_customer", {"customer_id": customer})
        assert customer_result.structuredContent["data"]["display_name"] == "Example Customer"


@pytest.mark.wire
async def test_native_mcp_rejects_tool_parameter_and_authority_injection(
    settings, database, customer
):
    async with session(settings, WORKER_TOKEN) as client:
        unknown = await client.call_tool("arbitrary_http", {"url": "http://internal.invalid"})
        assert unknown.isError and unknown.structuredContent["code"] == "tool_not_allowed"
        for field in ["tenant", "recipient", "credential", "authority", "approved", "url"]:
            result = await client.call_tool(
                "request_followup_send",
                {
                    "customer_id": customer,
                    "business_key": "wire-attack",
                    "message": "Booking?",
                    field: "untrusted-value",
                },
            )
            assert result.isError and result.structuredContent["code"] == "invalid_parameters"
    assert await database.fetchval("SELECT count(*) FROM followup_proposals") == 0


@pytest.mark.wire
async def test_native_mcp_write_is_pending_not_external_send(settings, database, customer):
    async with session(settings, WORKER_TOKEN) as client:
        result = await client.call_tool(
            "request_followup_send",
            {
                "customer_id": customer,
                "business_key": "wire-proposal",
                "message": "Would you like a booking?",
            },
        )
        assert not result.isError and result.structuredContent["code"] == "approval_required"
        assert result.structuredContent["data"]["state"] == "PENDING"
    assert await database.fetchval("SELECT count(*) FROM followup_proposals") == 1
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 0


@pytest.mark.wire
async def test_native_mcp_process_identity_limits_discovery_and_execution(
    settings, database, customer
):
    async with session(settings, READER_TOKEN) as client:
        assert [t.name for t in (await client.list_tools()).tools] == ["search_knowledge"]
        result = await client.call_tool(
            "request_followup_send",
            {"customer_id": customer, "business_key": "reader-attack", "message": "Booking?"},
        )
        assert result.isError and result.structuredContent["code"] == "tool_not_allowed"
    assert await database.fetchval("SELECT count(*) FROM workflow_outbox") == 0
