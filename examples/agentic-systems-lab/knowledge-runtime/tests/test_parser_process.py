import asyncio
import json
import subprocess
import sys

import pytest
from document_fixtures import docx

from knowledge_runtime.document_providers import run_process
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
        output, error = process.communicate(docx(), timeout=30)
    except subprocess.TimeoutExpired:
        process.kill()
        output, error = process.communicate()
        raise AssertionError("Synthetic worker stalled: " + error.decode()) from None
    assert process.returncode == 0, error.decode()
    assert json.loads(output)["ok"] is True, output


async def test_actual_process_timeout_kills_and_reaps(monkeypatch):
    active = []
    original = asyncio.create_subprocess_exec

    async def capture(*arguments, **kwargs):
        process = await original(*arguments, **kwargs)
        active.append(process)
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", capture)
    with pytest.raises(TimeoutError):
        await run_process([sys.executable, "-c", "import time; time.sleep(30)"], None, 0.05)
    assert len(active) == 1 and active[0].returncode == -9
