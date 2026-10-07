import json
import os
from pathlib import Path
from xml.etree import ElementTree

coverage = json.loads(Path("artifacts/coverage.json").read_text())["totals"]
root = ElementTree.parse("artifacts/junit.xml").getroot()
suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
summary = {
    "source_revision": os.environ.get("KNOWLEDGE_VERIFICATION_SHA", "local"),
    "tests": sum(int(s.attrib["tests"]) for s in suites),
    "failures": sum(int(s.attrib.get("failures", 0)) for s in suites),
    "errors": sum(int(s.attrib.get("errors", 0)) for s in suites),
    "skipped": sum(int(s.attrib.get("skipped", 0)) for s in suites),
    "statement_and_branch_coverage_percent": round(coverage["percent_covered"], 4),
}
Path("artifacts/verification.json").write_text(json.dumps(summary, indent=2) + "\n")
print("KNOWLEDGE_VERIFICATION " + json.dumps(summary))
