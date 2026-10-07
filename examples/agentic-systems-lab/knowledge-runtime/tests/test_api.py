import pytest
from conftest import OTHER_TOKEN, READER_TOKEN


async def test_api_runs_ingestion_search_status_delete(client):
    response = await client.post(
        "/documents",
        json={"source_key": "guide", "version": 1, "text": "Plumbing appointment booking policy"},
    )
    assert response.status_code == 200, response.text
    document_id = response.json()["document_id"]
    assert (await client.get("/documents/" + document_id)).json()["version"] == 1
    search = await client.post("/search", json={"query": "booking"})
    assert search.status_code == 200 and search.json()["citations"][0]["document_id"] == document_id
    deleted = await client.request(
        "DELETE", "/documents/" + document_id, json={"expected_version": 1}
    )
    assert deleted.status_code == 200
    assert (await client.post("/search", json={"query": "booking"})).json()["citations"] == []
    assert (await client.get("/health")).json()["state"] == "ready"
    assert "knowledge_operations_total" in (await client.get("/metrics")).text


@pytest.mark.parametrize("token", ["", b"Bearer \xe9", "Bearer invalid"])
async def test_api_authentication_fails_closed(client, token):
    response = await client.post(
        "/search", json={"query": "booking"}, headers={"Authorization": token}
    )
    assert response.status_code == 401


async def test_api_permission_and_cross_tenant_boundary(client):
    saved = (
        await client.post(
            "/documents", json={"source_key": "guide", "version": 1, "text": "Booking policy"}
        )
    ).json()
    forbidden = await client.post(
        "/documents",
        json={"source_key": "guide2", "version": 1, "text": "Booking policy"},
        headers={"Authorization": "Bearer " + READER_TOKEN},
    )
    assert forbidden.status_code == 403
    other = await client.get(
        "/documents/" + saved["document_id"], headers={"Authorization": "Bearer " + OTHER_TOKEN}
    )
    assert other.status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"query": ""},
        {"query": "policy", "filters": {"tenant": "other"}},
        {"query": "policy", "initial_k": 101},
        {"query": "policy", "top_k": 11},
        {"query": "policy", "url": "http://internal"},
    ],
)
async def test_api_query_schema_rejections(client, body):
    assert (await client.post("/search", json=body)).status_code == 422
