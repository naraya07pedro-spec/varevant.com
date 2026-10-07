"""Generated, synthetic fixtures; no client files or binary fixture corpus."""

import io
import zipfile
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

INVOICE_TEXT = "Invoice INV-DEMO-1\nTotal: 125.50 USD"


def write_zip_entry(archive, name, content):
    # Byte identity must stay stable across replay/lease tests.
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, content)


def docx(text=INVOICE_TEXT, xml=None, extras=None):
    document = xml or (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        + "".join(
            "<w:p><w:r><w:t>" + escape(line) + "</w:t></w:r></w:p>" for line in text.splitlines()
        )
        + "</w:body></w:document>"
    )
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        write_zip_entry(archive, "[Content_Types].xml", "<Types/>")
        write_zip_entry(archive, "word/document.xml", document)
        for key, value in (extras or {}).items():
            write_zip_entry(archive, key, value)
    return output.getvalue()


def digital_pdf(text=INVOICE_TEXT, pages=1, encrypted=False):
    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    font_ref = writer._add_object(font)
    for _ in range(pages):
        page = writer.add_blank_page(width=600, height=800)
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})}
        )
        commands = ["BT /F1 20 Tf 60 730 Td"]
        for index, line in enumerate(text.splitlines()):
            safe = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            if index:
                commands.append("0 -30 Td")
            commands.append("(" + safe + ") Tj")
        commands.append("ET")
        stream = DecodedStreamObject()
        stream.set_data(" ".join(commands).encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("synthetic-password")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def image_file(format="PNG", text=INVOICE_TEXT, size=(1100, 450)):
    image = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42)
    draw.multiline_text((50, 80), text, fill="black", font=font, spacing=30)
    output = io.BytesIO()
    image.save(output, format=format)
    return output.getvalue()
