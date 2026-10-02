// Verify the recorded evidence and provenance; this does not substitute for running n8n.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const read = path => readFile(join(here, path));
const json = async path => JSON.parse(await read(path));
const report = await json('recorded/report.json');
assert.equal(report.label, 'REPRODUCED RECOVERY TEST');
assert.equal(report.historical_production_execution, false);
assert.equal(report.environment.n8n, '1.100.1');
assert.equal(sha(await read('input.json')), report.input_sha256);
assert.equal(sha(await read('package-lock.json')), report.environment.package_lock_sha256);
assert.equal(sha(await read('run-recovery.mjs')), report.harness_sha256);
const fixture = await json('input.json');
assert.deepEqual(fixture, report.input);
const imported = {};
for (const [phase, source] of [['before', 'v19-fetch-error-handler.json'], ['after', 'v19-1-fetch-error-handler.json']]) {
  const result = report.results[phase];
  const handler = await json(`../source/${source}`);
  const execution = await json(`recorded/${phase}.execution.json`);
  imported[phase] = await json(`recorded/${phase}.workflow.json`);
  assert.equal(sha(await read(`recorded/${phase}.execution.json`)), result.published_execution_sha256);
  assert.equal(sha(await read(`recorded/${phase}.workflow.json`)), result.workflow_sha256);
  assert.equal(sha(handler.parameters.jsCode), result.handler_code_sha256);
  assert.equal(execution.label, 'REPRODUCED RECOVERY TEST / NOT HISTORICAL PRODUCTION EXECUTION');
  assert.equal(execution.status, phase === 'before' ? 'error' : 'success');
  assert.equal(execution.finished, phase === 'after');
  assert.equal(execution.executionId, result.execution_id);
  assert.ok(execution.startedAt && execution.stoppedAt);
  const embedded = execution.workflowData.nodes.find(n => n.name === handler.name);
  assert.equal(embedded.parameters.jsCode, handler.parameters.jsCode);
  assert.equal(embedded.parameters.mode, 'runOnceForEachItem');
  assert.deepEqual(execution.data.resultData.runData['Synthetic Fetch Failure'][0].data.main[0][0].json, fixture);
  assert.equal(imported[phase].active, false);
  assert.ok(imported[phase].nodes.every(n => ['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.code', 'n8n-nodes-base.noOp'].includes(n.type)));
  if (phase === 'before') assert.equal(execution.data.resultData.error.message, result.error.message);
  else {
    assert.equal(execution.data.resultData.error, undefined);
    assert.equal(execution.data.resultData.lastNodeExecuted, 'Reproduced Stop');
    assert.deepEqual(execution.data.resultData.runData[handler.name][0].data.main[0][0].json,
      { ...fixture, search_html: '', public_search_error: true });
  }
}
imported.before.nodes[2].parameters.jsCode = null;
imported.after.nodes[2].parameters.jsCode = null;
assert.deepEqual(imported.before, imported.after);
console.log('Recorded reproduction verified: hashes, embedded handler code, identical input, error → final success, synthetic scope.');
