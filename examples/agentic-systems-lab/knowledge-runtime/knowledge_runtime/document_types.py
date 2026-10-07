from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal, Protocol

from pydantic import Field, field_validator

from knowledge_runtime.domain import StrictModel

PDF = "application/pdf"
PNG = "image/png"
JPEG = "image/jpeg"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
SUPPORTED_MIMES = frozenset({PDF, PNG, JPEG, DOCX})
MAX_FILE_BYTES = 5_242_880
PIPELINE_VERSION = "invoice-v1"


class SourceInput(StrictModel):
    source_key: str = Field(min_length=1, max_length=160, pattern=r"^[\w./:-]+$")


class ParseResult(StrictModel):
    text: str = Field(default="", max_length=100_000)
    images: list[str] = Field(default_factory=list, max_length=5)
    pages: int = Field(default=1, ge=1, le=20)

    @field_validator("text")
    @classmethod
    def valid_text(cls, value: str) -> str:
        if any(ord(c) < 32 and c not in "\n\r\t" for c in value):
            raise ValueError("invalid controls")
        return value

    @field_validator("images")
    @classmethod
    def bounded_images(cls, values: list[str]) -> list[str]:
        if any(len(v) > 8_000_000 for v in values):
            raise ValueError("oversized normalized image")
        return values


class OCRResult(StrictModel):
    text: str = Field(max_length=100_000)
    quality: float = Field(ge=0, le=1, allow_inf_nan=False)

    @field_validator("text")
    @classmethod
    def valid_text(cls, value: str) -> str:
        return ParseResult.valid_text(value)


class ExtractionCandidate(StrictModel):
    fields: dict[str, Any]
    quality: float = Field(ge=0, le=1, allow_inf_nan=False)
    reason: Literal["complete", "missing_fields", "ambiguous_fields"]


class InvoiceFields(StrictModel):
    invoice_id: str = Field(pattern=r"^INV-[A-Z0-9-]{1,40}$")
    total: str = Field(pattern=r"^[0-9]{1,12}\.[0-9]{2}$")
    currency: Literal["USD", "IDR", "MYR"]

    @field_validator("total")
    @classmethod
    def positive_total(cls, value: str) -> str:
        if Decimal(value) <= 0:
            raise ValueError("nonpositive total")
        return value


class Parser(Protocol):
    name: str

    async def parse(self, content: bytes, mime: str) -> ParseResult: ...


class OCR(Protocol):
    name: str

    async def recognize(self, image: bytes) -> OCRResult: ...


class Extractor(Protocol):
    name: str

    async def extract(self, text: str) -> ExtractionCandidate: ...
