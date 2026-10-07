from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

root = Path.cwd().resolve()
paths = [root / 'README.md', root / 'SECURITY.md']
paths += list((root / 'docs').rglob('*.md'))
paths += list((root / 'n8n').rglob('*.md'))
paths += list((root / 'examples').rglob('*.md'))
count = 0
for path in paths:
    if any(part in {'node_modules', '.git', '.venv', 'venv', '.tox'} for part in path.parts):
        continue
    for target in re.findall(r'\[[^\]]*\]\(([^\s)]+)\)', path.read_text(encoding='utf-8')):
        parsed = urlsplit(target)
        if parsed.scheme:
            if parsed.scheme not in {'https', 'http', 'mailto'} or (parsed.scheme != 'mailto' and not parsed.netloc):
                raise SystemExit(f'Malformed target in {path.relative_to(root)}: {target}')
        elif parsed.path:
            dest = (path.parent / unquote(parsed.path)).resolve()
            if not dest.is_relative_to(root) or not dest.exists():
                raise SystemExit(f'Missing local target in {path.relative_to(root)}: {target}')
        count += 1
print(f'Checked {count} portfolio Markdown targets; local existence and URL syntax, no remote requests')
