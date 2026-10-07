from __future__ import annotations

import asyncio

from starlette.types import ASGIApp, Message, Receive, Scope, Send


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp, maximum: int) -> None:
        self.app = app
        self.maximum = maximum

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers", []))
        declared: int | None = None
        if b"content-length" in headers:
            try:
                declared = int(headers[b"content-length"])
            except ValueError:
                await self.reject(send, 400, "invalid_content_length")
                return
            if declared < 0:
                await self.reject(send, 400, "invalid_content_length")
                return
            if declared > self.maximum:
                await self.reject(send, 413, "body_too_large")
                return
        body = bytearray()
        try:
            async with asyncio.timeout(15):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body.extend(message.get("body", b""))
                    if len(body) > self.maximum:
                        await self.reject(send, 413, "body_too_large")
                        return
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            await self.reject(send, 408, "body_timeout")
            return
        if declared is not None and declared != len(body):
            await self.reject(send, 400, "content_length_mismatch")
            return
        consumed = False

        async def replay() -> Message:
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)

    @staticmethod
    async def reject(send: Send, status: int, code: str) -> None:
        payload = ('{"ok":false,"code":"' + code + '"}').encode()
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [(b"content-type", b"application/json"), (b"connection", b"close")],
            }
        )
        await send({"type": "http.response.body", "body": payload})
