import json
import os
from uuid import uuid4

import httpx

from knowledge_runtime.security import Settings

settings = Settings()
worker = next(
    key for key, principal in settings.token_bindings.items() if "ingest" in principal.permissions
)
reviewer = next(
    key for key, principal in settings.token_bindings.items() if "approve" in principal.permissions
)
url = os.environ.get("KNOWLEDGE_SMOKE_URL", "http://127.0.0.1:8000")
with httpx.Client(
    base_url=url, headers={"Authorization": "Bearer " + worker}, timeout=15
) as client:
    request = {
        "source_key": "smoke/" + uuid4().hex,
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
    proposal = client.post(
        "/tools/request_followup_send",
        json={
            "parameters": {
                "customer_id": "synthetic-customer",
                "business_key": "smoke-" + uuid4().hex,
                "message": "Would you like a synthetic booking?",
            }
        },
    )
    assert proposal.status_code == 200 and proposal.json()["code"] == "approval_required"
    proposal_id = proposal.json()["data"]["proposal_id"]
    human = {"Authorization": "Bearer " + reviewer}
    review = client.get("/approvals/" + proposal_id, headers=human)
    assert review.status_code == 200
    approved = client.post(
        "/approvals/" + proposal_id,
        headers=human,
        json={
            "decision": "approve",
            "request_hash": review.json()["request_hash"],
        },
    )
    assert approved.status_code == 200 and approved.json()["data"]["state"] == "APPROVED"
    counts = client.post("/tools/get_pipeline_status", json={"parameters": {}})
    assert counts.status_code == 200 and counts.json()["data"]["ready_handoffs"] >= 1
print(
    json.dumps(
        {
            "retrieval_tcp_smoke": "passed",
            "gateway_tcp_smoke": "passed",
            "external_delivery": "not_dispatched",
        }
    )
)
