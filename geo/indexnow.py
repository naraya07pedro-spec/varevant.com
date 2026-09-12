#!/usr/bin/env python3
import json
import pathlib
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITEMAP = ROOT / "sitemap.xml"
KEY = "21b9fcd1a38e4c879b6a4e4d1d2f93ac"
HOST = "varevant.com"
KEY_URL = f"https://{HOST}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/indexnow"


def sitemap_urls():
    root = ET.fromstring(SITEMAP.read_text(encoding="utf-8"))
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = []
    for loc in root.findall("sm:url/sm:loc", ns):
        if loc.text:
            url = loc.text.strip()
            if url.startswith(f"https://{HOST}/"):
                urls.append(url)
    return sorted(set(urls))


def main():
    urls = sitemap_urls()
    if not urls:
        print("No eligible URLs found in sitemap.")
        return 0

    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_URL,
        "urlList": urls,
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status = response.status
            text = response.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"IndexNow submission failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps({"status": status, "submitted": urls, "response": text}, indent=2))
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    raise SystemExit(main())
