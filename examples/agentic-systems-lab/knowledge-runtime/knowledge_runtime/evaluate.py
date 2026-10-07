from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

from knowledge_runtime.database import migrate, pool
from knowledge_runtime.domain import IngestDocument, SearchQuery
from knowledge_runtime.observability import Audit
from knowledge_runtime.retrieval import Retrieval
from knowledge_runtime.security import Principal


async def evaluate(url: str) -> dict[str, Any]:
    if not url.split("?")[0].endswith("_test"):
        raise ValueError("Evaluation requires a disposable *_test database")
    await migrate(url)
    database = await pool(url)
    principal = Principal(
        tenant="eval-" + uuid4().hex,
        subject="evaluator",
        permissions=["read", "ingest"],
    )
    try:
        dataset = json.loads((Path(__file__).parent.parent / "evals/cases.json").read_text())
        service = Retrieval(database, Audit(database))
        for document in dataset["documents"]:
            await service.ingest(principal, IngestDocument.model_validate(document))
        outcomes = []
        for case in dataset["cases"]:
            query = SearchQuery.model_validate(
                {
                    "query": case["query"],
                    "filters": case.get("filters", {}),
                    "top_k": 1,
                }
            )
            result = await service.search(principal, query)
            actual = result.citations[0].source_key if result.citations else None
            outcomes.append({"id": case["id"], "passed": actual == case["expected"]})
        return {
            "cases": outcomes,
            "passed": sum(c["passed"] for c in outcomes),
            "total": len(outcomes),
            "provider": service.embedding.name,
            "boundary": "Synthetic lexical/provenance regression; not semantic LLM quality",
        }
    finally:
        await database.execute("DELETE FROM chunks WHERE tenant=$1", principal.tenant)
        await database.execute("DELETE FROM documents WHERE tenant=$1", principal.tenant)
        await database.execute("DELETE FROM audit_events WHERE tenant=$1", principal.tenant)
        await database.close()


async def main() -> None:
    result = await evaluate(os.environ["TEST_DATABASE_URL"])
    directory = Path("artifacts")
    directory.mkdir(exist_ok=True)
    (directory / "evals.json").write_text(json.dumps(result, indent=2) + "\n")
    print(f"Retrieval evals: {result['passed']}/{result['total']}")
    if result["passed"] != result["total"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
