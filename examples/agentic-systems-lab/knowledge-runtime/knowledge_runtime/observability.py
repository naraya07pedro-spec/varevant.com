from __future__ import annotations

import json
import logging
from typing import Any

import asyncpg
from prometheus_client import CollectorRegistry, Counter, generate_latest

from knowledge_runtime.security import Principal

logger = logging.getLogger("knowledge.audit")


class Audit:
    def __init__(self, database: asyncpg.Pool[Any]) -> None:
        self.database = database
        self.registry = CollectorRegistry()
        self.operations = Counter(
            "knowledge_operations",
            "Bounded operation outcomes",
            ["operation", "outcome"],
            registry=self.registry,
        )

    async def record(self, principal: Principal, operation: str, outcome: str) -> None:
        await self.database.execute(
            "INSERT INTO audit_events(tenant,subject,operation,outcome) VALUES($1,$2,$3,$4)",
            principal.tenant,
            principal.subject,
            operation,
            outcome,
        )
        self.operations.labels(operation=operation, outcome=outcome).inc()
        logger.info(json.dumps({"operation": operation, "outcome": outcome}))

    def metrics(self) -> bytes:
        return generate_latest(self.registry)
