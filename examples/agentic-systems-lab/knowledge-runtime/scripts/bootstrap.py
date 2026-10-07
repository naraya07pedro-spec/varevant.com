import json
import secrets
from pathlib import Path

path = Path(".env")
if path.exists():
    raise SystemExit("Existing .env preserved; remove it explicitly to generate fresh local keys")
worker = secrets.token_urlsafe(32)
reviewer = secrets.token_urlsafe(32)
tools = [
    "search_knowledge",
    "get_document_status",
    "get_extraction_status",
    "search_customer",
    "draft_followup",
    "request_followup_send",
    "get_pipeline_status",
]
bindings = {
    worker: {
        "tenant": "demo",
        "subject": "worker",
        "permissions": ["read", "ingest", "delete", "propose"],
        "tools": tools,
    },
    reviewer: {
        "tenant": "demo",
        "subject": "human-reviewer",
        "permissions": ["read", "approve"],
        "tools": [],
    },
}
path.write_text(
    "KNOWLEDGE_DATABASE_URL=postgresql://knowledge:local-demo-only@db:5432/knowledge\n"
    + "KNOWLEDGE_TOKEN_BINDINGS='"
    + json.dumps(bindings, separators=(",", ":"))
    + "'\n"
    + "KNOWLEDGE_MCP_TOKEN="
    + worker
    + "\nKNOWLEDGE_OCR=tesseract\n"
)
path.chmod(0o600)
print("Generated local process/API credentials in ignored .env; values suppressed")
