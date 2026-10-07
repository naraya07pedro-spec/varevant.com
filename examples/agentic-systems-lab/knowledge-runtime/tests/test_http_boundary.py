import pytest

from knowledge_runtime.http_boundary import BodyLimitMiddleware


@pytest.mark.parametrize(
    "declared,body,status",
    [
        ("999999", b"a", 413),
        ("abc", b"a", 400),
        ("-1", b"a", 400),
        ("1", b"ab", 400),
        (None, b"a" * 1025, 413),
        ("0", b"", 204),
    ],
)
async def test_body_limit_validates_observed_and_declared_lengths(declared, body, status):
    events = []

    async def app(scope, receive, send):
        received = await receive()
        assert received["body"] == body
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(event):
        events.append(event)

    headers = [] if declared is None else [(b"content-length", declared.encode())]
    await BodyLimitMiddleware(app, 1024)({"type": "http", "headers": headers}, receive, send)
    assert events[0]["status"] == status


async def test_streamed_body_cannot_bypass_limit_with_missing_header():
    events = []
    messages = iter(
        [
            {"type": "http.request", "body": b"a" * 600, "more_body": True},
            {"type": "http.request", "body": b"b" * 600, "more_body": False},
        ]
    )

    async def app(*args):
        raise AssertionError("Oversized input reached application")

    async def receive():
        return next(messages)

    async def send(event):
        events.append(event)

    await BodyLimitMiddleware(app, 1024)({"type": "http", "headers": []}, receive, send)
    assert events[0]["status"] == 413
