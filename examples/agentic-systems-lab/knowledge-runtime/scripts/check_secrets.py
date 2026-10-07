import re
import subprocess
from pathlib import Path

root = Path.cwd()
tracked = subprocess.check_output(["git", "ls-files", "-z", "--", "."], text=True)
patterns = [
    re.compile(
        r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})"
    ),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"postgres(?:ql)?://[^/\s:@]+:[^@\s]+@(?!db\b|localhost\b|127\.0\.0\.1\b)[^\s]+"),
]
count = 0
for name in tracked.split("\0"):
    if not name:
        continue
    path = root / name
    if path.name == ".env":
        raise SystemExit("Credential environment file must not be tracked")
    try:
        text = path.read_text()
    except (UnicodeDecodeError, FileNotFoundError):
        continue
    if any(pattern.search(text) for pattern in patterns):
        raise SystemExit(f"Credential-shaped content in {name}; matched value suppressed")
    count += 1
print(f"Scanned {count} tracked text files for selected credential patterns")
