import asyncio
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from document_fixtures import docx

from knowledge_runtime.document_providers import SubprocessParser, run_process
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


async def test_worker_environment_omits_service_and_cloud_credentials(monkeypatch):
    names = ["KNOWLEDGE_TOKEN_BINDINGS", "KNOWLEDGE_DATABASE_URL", "AWS_SECRET_ACCESS_KEY"]
    for name in names:
        monkeypatch.setenv(name, "synthetic-do-not-forward")
    monkeypatch.setenv("LANG", "C.UTF-8")
    code = (
        "import json, os;"
        "print(json.dumps({k:os.environ.get(k) for k in "
        "['KNOWLEDGE_TOKEN_BINDINGS','KNOWLEDGE_DATABASE_URL','AWS_SECRET_ACCESS_KEY','LANG']}))"
    )
    output = await run_process([sys.executable, "-c", code], None, 5)
    result = json.loads(output)
    assert all(result[name] is None for name in names)
    assert result["LANG"] == "C.UTF-8"
    assert b"synthetic-do-not-forward" not in output


async def test_parent_removes_files_after_killed_parser(monkeypatch, tmp_path):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    marker = tmp_path / "worker-path.txt"
    original = asyncio.create_subprocess_exec
    code = (
        "import os, sys, time;"
        "from pathlib import Path;"
        "folder=Path(os.environ['TMPDIR']);"
        "(folder/'synthetic-private.pdf').write_bytes(b'synthetic-private-file');"
        "Path(sys.argv[1]).write_text(str(folder));"
        "time.sleep(30)"
    )

    async def synthetic_worker(*arguments, **kwargs):
        return await original(sys.executable, "-c", code, str(marker), **kwargs)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", synthetic_worker)
    with pytest.raises(TimeoutError):
        await SubprocessParser(timeout=1.5).parse(docx(), DOCX)
    assert marker.exists()
    assert not Path(marker.read_text()).exists()
    assert list(tmp_path.iterdir()) == [marker]
