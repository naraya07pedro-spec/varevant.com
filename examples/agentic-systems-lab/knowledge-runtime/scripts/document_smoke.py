"""Real TCP + Docker parser/OCR smoke using generated synthetic documents."""

import io
import json
import os
import zipfile
from uuid import uuid4

import httpx
from PIL import Image, ImageDraw, ImageFont

from knowledge_runtime.document_types import DOCX, PNG
from knowledge_runtime.security import Settings

settings = Settings()
worker = next(
    key for key, principal in settings.token_bindings.items() if "ingest" in principal.permissions
)
output = io.BytesIO()
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("[Content_Types].xml", "<Types/>")
    archive.writestr(
        "word/document.xml",
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body><w:p><w:r><w:t>Invoice INV-DEMO-1</w:t></w:r></w:p>"
        "<w:p><w:r><w:t>Total: 125.50 USD</w:t></w:r></w:p></w:body></w:document>",
    )
image = Image.new("RGB", (1100, 450), "white")
ImageDraw.Draw(image).multiline_text(
    (50, 80),
    "Invoice INV-DEMO-1\nTotal: 125.50 USD",
    fill="black",
    font=ImageFont.load_default(size=42),
    spacing=30,
)
picture = io.BytesIO()
image.save(picture, format="PNG")
url = os.environ.get("KNOWLEDGE_SMOKE_URL", "http://127.0.0.1:8000")
with httpx.Client(
    base_url=url, headers={"Authorization": "Bearer " + worker}, timeout=30
) as client:
    for mime, content in [(DOCX, output.getvalue()), (PNG, picture.getvalue())]:
        headers = {"Content-Type": mime, "X-Source-Key": "smoke/" + uuid4().hex}
        saved = client.post("/document-jobs", content=content, headers=headers)
        assert saved.status_code == 200 and saved.json()["state"] == "EXTRACTED", saved.text
        job_id = saved.json()["job_id"]
        replay = client.post("/document-jobs", content=content, headers=headers)
        assert replay.json() == saved.json()
        status = client.post(
            "/tools/get_extraction_status", json={"parameters": {"job_id": job_id}}
        )
        assert status.json()["data"]["fields"]["total"] == "125.50"
print(json.dumps({"document_tcp_smoke": "passed", "native_parser": "docx", "real_ocr": "png"}))
