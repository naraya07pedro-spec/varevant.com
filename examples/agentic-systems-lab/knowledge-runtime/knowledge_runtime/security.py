from __future__ import annotations

import secrets
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from knowledge_runtime.domain import BoundaryError, StrictModel


class Principal(StrictModel):
    tenant: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    subject: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9_-]+$")
    permissions: list[Literal["read", "ingest", "delete", "propose", "approve"]]
    tools: list[str] = Field(default_factory=list)

    def require(self, permission: str) -> None:
        if permission not in self.permissions:
            raise BoundaryError("permission_denied", 403)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="KNOWLEDGE_", env_file=".env", extra="ignore")
    database_url: str
    token_bindings: dict[str, Principal]
    mcp_token: str = ""
    provider_timeout: float = Field(default=10.0, gt=0, le=60)
    max_body_bytes: int = Field(default=5_242_880, ge=1024, le=10_485_760)
    parser_timeout: float = Field(default=10.0, gt=0, le=30)
    ocr: Literal["disabled", "tesseract"] = "disabled"

    def authenticate(self, token: str) -> Principal:
        # Reject short configured credentials too; no built-in demo key fallback.
        for configured, identity in self.token_bindings.items():
            if len(configured) >= 32 and secrets.compare_digest(configured, token):
                return identity
        raise BoundaryError("unauthenticated", 401)
