from __future__ import annotations

import asyncio
import json
from typing import Any

from mcp import types
from mcp.server import Server
from mcp.server.stdio import stdio_server

from knowledge_runtime.database import pool
from knowledge_runtime.domain import BoundaryError
from knowledge_runtime.gateway import Gateway
from knowledge_runtime.observability import Audit
from knowledge_runtime.retrieval import Retrieval
from knowledge_runtime.security import Settings
from knowledge_runtime.workflow import GatewayReply, Workflow


async def main() -> None:
    try:
        settings = Settings()
        principal = settings.authenticate(settings.mcp_token)
    except (ValueError, BoundaryError) as exc:
        raise SystemExit("invalid_mcp_process_configuration") from exc
    database = await pool(settings.database_url)
    audit = Audit(database)
    retrieval = Retrieval(database, audit, timeout=settings.provider_timeout)
    gateway = Gateway(retrieval, Workflow(database, audit), audit)
    server: Server[Any] = Server("knowledge-workflow-gateway")

    @server.list_tools()  # type: ignore[no-untyped-call,untyped-decorator]
    async def tools() -> list[types.Tool]:
        return [
            types.Tool(
                name=spec.name,
                description=spec.description,
                inputSchema=spec.schema.model_json_schema(),
                outputSchema=GatewayReply.model_json_schema(mode="serialization"),
                annotations=types.ToolAnnotations(
                    readOnlyHint=spec.effect == "read",
                    destructiveHint=False,
                    idempotentHint=True,
                    openWorldHint=False,
                ),
            )
            for spec in gateway.exposed(principal)
        ]

    # Central strict Pydantic validation returns a redacted structured error contract.
    # SDK input validation is disabled solely to avoid a second, inconsistent error shape.
    @server.call_tool(validate_input=False)  # type: ignore[untyped-decorator]
    async def call(name: str, arguments: dict[str, Any]) -> types.CallToolResult:
        result = await gateway.call(principal, name, arguments)
        payload = result.model_dump()
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=json.dumps(payload))],
            structuredContent=payload,
            isError=not result.ok,
        )

    try:
        async with stdio_server() as (read, write):
            await server.run(read, write, server.create_initialization_options())
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
