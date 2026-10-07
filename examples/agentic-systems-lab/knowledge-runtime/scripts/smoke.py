import json
import os

import httpx

from knowledge_runtime.security import Settings

settings = Settings()
worker = next(
    key for key, principal in settings.token_bindings.items() if "ingest" in principal.permissions
)
url = os.environ.get("KNOWLEDGE_SMOKE_URL", "http://127.0.0.1:8000")
with httpx.Client(
    base_url=url, headers={"Authorization": "Bearer " + worker}, timeout=15
) as client:
    request = {
        "source_key": "smoke/booking",
        "version": 1,
        "text": "Emergency plumbing appointments use the verified calendar.",
    }
    saved = client.post("/documents", json=request)
    assert saved.status_code == 200, saved.status_code
    document_id = saved.json()["document_id"]
    result = client.post("/search", json={"query": "plumbing calendar"})
    assert result.status_code == 200 and result.json()["citations"][0]["document_id"] == document_id
    assert client.post("/documents", json=request).json()["state"] == "duplicate"
    request.update(version=2, text="Roofing estimates require a roof inspection.")
    assert client.post("/documents", json=request).json()["state"] == "updated"
    assert client.post("/search", json={"query": "plumbing calendar"}).json()["citations"] == []
    assert (
        client.request(
            "DELETE", "/documents/" + document_id, json={"expected_version": 2}
        ).status_code
        == 200
    )
print(json.dumps({"retrieval_tcp_smoke": "passed"}))
