import json
import subprocess
import sys

from document_fixtures import docx

from knowledge_runtime.document_types import DOCX


def test_native_parser_exits_under_coverage_instrumentation():
    code = (
        "import faulthandler, runpy, sys;"
        "faulthandler.dump_traceback_later(3, repeat=True);"
        "sys.argv=['knowledge_runtime.parser_worker', sys.argv[1]];"
        "runpy.run_module('knowledge_runtime.parser_worker', run_name='__main__')"
    )
    process = subprocess.Popen(
        [sys.executable, "-c", code, DOCX],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    try:
        output, error = process.communicate(docx(), timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        output, error = process.communicate()
        raise AssertionError("Synthetic worker stalled: " + error.decode()) from None
    assert process.returncode == 0, error.decode()
    assert json.loads(output)["ok"] is True, output
