#!/usr/bin/env python3
import json, pathlib, re, sys, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors=[]
checks=[]

def ok(name, condition, detail=""):
    checks.append((name, bool(condition), detail))
    if not condition:
        errors.append(f"{name}: {detail}")

index=(ROOT/'index.html').read_text(encoding='utf-8', errors='ignore')
robots=(ROOT/'robots.txt').read_text(encoding='utf-8', errors='ignore')
sitemap=(ROOT/'sitemap.xml').read_text(encoding='utf-8', errors='ignore')

ok('homepage canonical', 'https://varevant.com/' in index and 'rel="canonical"' in index)
ok('robots allows crawl', 'Allow: /' in robots and 'Disallow: /' not in robots)
ok('robots sitemap', 'https://varevant.com/sitemap.xml' in robots)
try:
    ET.fromstring(sitemap)
    ok('sitemap XML', True)
except Exception as e:
    ok('sitemap XML', False, str(e))

for p in ROOT.rglob('*.html'):
    txt=p.read_text(encoding='utf-8', errors='ignore')
    rel=str(p.relative_to(ROOT))
    ok(f'{rel} title', bool(re.search(r'<title>.+?</title>', txt, re.S)), 'missing title')
    ok(f'{rel} description', 'name="description"' in txt, 'missing meta description')
    ok(f'{rel} canonical', 'rel="canonical"' in txt, 'missing canonical')
    ok(f'{rel} noindex', 'noindex' not in txt.lower(), 'page is noindex')
    for href in re.findall(r'href="([^"]+)"', txt):
        if href.startswith(('http://','https://','mailto:','tel:','#','javascript:')):
            continue
        clean=href.split('#')[0].split('?')[0]
        if not clean:
            continue
        if clean.startswith('/'):
            target=(ROOT/clean.lstrip('/')).resolve()
        else:
            target=(p.parent/clean).resolve()
        if clean.endswith('/'):
            target=target/'index.html'
        if not target.exists():
            ok(f'{rel} internal link {href}', False, 'target missing')

# JSON-LD syntax check for every script block.
for p in ROOT.rglob('*.html'):
    txt=p.read_text(encoding='utf-8', errors='ignore')
    for i, block in enumerate(re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', txt, re.S),1):
        try:
            json.loads(block)
            ok(f'{p.relative_to(ROOT)} JSON-LD {i}', True)
        except Exception as e:
            ok(f'{p.relative_to(ROOT)} JSON-LD {i}', False, str(e))

passed=sum(1 for _,v,_ in checks if v)
score=round(passed/len(checks)*100) if checks else 0
print(json.dumps({'quality_score':score,'checks':len(checks),'errors':errors}, indent=2))
if errors or score < 90:
    sys.exit(1)
