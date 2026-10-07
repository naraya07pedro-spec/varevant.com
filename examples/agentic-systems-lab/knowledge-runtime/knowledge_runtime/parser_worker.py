"""Killable Linux worker: local bytes only, bounded parsers, no external resources."""

from __future__ import annotations

import base64
import io
import json
import resource
import subprocess
import sys
import tempfile
import warnings
import zipfile
from pathlib import Path, PurePosixPath

from defusedxml.ElementTree import fromstring
from PIL import Image

from knowledge_runtime.document_types import DOCX, JPEG, MAX_FILE_BYTES, PDF, PNG
from knowledge_runtime.domain import BoundaryError

MAX_TEXT = 100_000
MAX_PIXELS = 4_000_000


def image_frame(content: bytes, mime: str) -> str:
    expected = "PNG" if mime == PNG else "JPEG"
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(content)) as image:
            if image.format != expected:
                raise BoundaryError("mime_mismatch")
            if image.width * image.height > MAX_PIXELS or getattr(image, "n_frames", 1) != 1:
                raise BoundaryError("image_limit")
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            normalized = image.convert("L")
            output = io.BytesIO()
            normalized.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


def docx_text(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if len(entries) > 1000 or sum(e.file_size for e in entries) > 20_000_000:
            raise BoundaryError("archive_limit")
        names = [e.filename for e in entries]
        if len(names) != len(set(names)):
            raise BoundaryError("invalid_archive")
        for entry in entries:
            path = PurePosixPath(entry.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in entry.filename:
                raise BoundaryError("invalid_archive")
            if entry.flag_bits & 1:
                raise BoundaryError("encrypted_document")
        if "word/document.xml" not in names or "[Content_Types].xml" not in names:
            raise BoundaryError("invalid_docx")
        xml = archive.read("word/document.xml")
        root = fromstring(xml, forbid_dtd=True)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs = [
            "".join(t.text or "" for t in p.findall(".//w:t", ns))
            for p in root.findall(".//w:p", ns)
        ]
        return "\n".join(paragraphs)


def pdf_text(content: bytes) -> dict[str, object]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content), strict=True)
    if reader.is_encrypted:
        raise BoundaryError("encrypted_document")
    count = len(reader.pages)
    if count < 1 or count > 20:
        raise BoundaryError("page_limit")
    texts = []
    for page in reader.pages:
        stream = page.get_contents()
        if stream is not None and len(stream.get_data()) > 4_000_000:
            raise BoundaryError("pdf_stream_limit")
        text = page.extract_text() or ""
        if len(text) > MAX_TEXT:
            raise BoundaryError("text_limit")
        texts.append(text)
    joined = "\n".join(texts)
    if len(joined) > MAX_TEXT:
        raise BoundaryError("text_limit")
    # Any blank page triggers whole-document OCR, avoiding partial native extraction.
    if all(t.strip() for t in texts):
        return {"text": joined, "images": [], "pages": count}
    if count > 5:
        raise BoundaryError("ocr_page_limit")
    with tempfile.TemporaryDirectory(prefix="knowledge-pdf-") as directory:
        source = Path(directory) / "input.pdf"
        source.write_bytes(content)
        subprocess.run(
            [
                "pdftoppm",
                "-f",
                "1",
                "-l",
                str(count),
                "-r",
                "100",
                "-scale-to",
                "1600",
                "-gray",
                "-png",
                str(source),
                str(Path(directory) / "page"),
            ],
            check=True,
            timeout=5,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        frames = sorted(Path(directory).glob("page-*.png"))
        if len(frames) != count:
            raise BoundaryError("parser_failed")
        images = [image_frame(frame.read_bytes(), PNG) for frame in frames]
    return {"text": "", "images": images, "pages": count}


def parse(content: bytes, mime: str) -> dict[str, object]:
    if mime == PDF:
        result = pdf_text(content)
    elif mime in {PNG, JPEG}:
        result = {"text": "", "images": [image_frame(content, mime)], "pages": 1}
    elif mime == DOCX:
        result = {"text": docx_text(content), "images": [], "pages": 1}
    else:
        raise BoundaryError("unsupported_mime")
    text = str(result["text"])
    if len(text) > MAX_TEXT:
        raise BoundaryError("text_limit")
    if any(ord(c) < 32 and c not in "\n\r\t" for c in text):
        raise BoundaryError("invalid_text")
    return result


def main() -> None:
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (30, 30))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    try:
        content = sys.stdin.buffer.read(MAX_FILE_BYTES + 1)
        if not content or len(content) > MAX_FILE_BYTES:
            raise BoundaryError("file_size")
        result = parse(content, sys.argv[1])
        print(json.dumps({"ok": True, "result": result}))
    except BoundaryError as exc:
        print(json.dumps({"ok": False, "code": exc.code}))
    except FileNotFoundError:
        print(json.dumps({"ok": False, "code": "parser_dependency_unavailable"}))
    except Exception:
        # Parser exception messages may contain filenames, text or document metadata.
        print(json.dumps({"ok": False, "code": "parser_failed"}))


if __name__ == "__main__":
    main()
