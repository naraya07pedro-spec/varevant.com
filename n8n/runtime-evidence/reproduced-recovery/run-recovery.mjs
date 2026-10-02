// REPRODUCED RECOVERY TEST / NOT HISTORICAL PRODUCTION EXECUTION
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] || join(here, 'results'));
const runtime = process.env.N8N_RUNTIME_ROOT || here;
const require = createRequire(join(runtime, 'package.json'));
const n8nPackage = require.resolve('n8n/package.json');
const n8nInfo = JSON.parse(await readFile(n8nPackage, 'utf8'));
assert.equal(n8nInfo.version, '1.100.1');
const cli = join(dirname(n8nPackage), 'bin/n8n');
const sqlite3 = require('sqlite3');
const { parse: parseFlatted } = require('flatted');
const input = JSON.parse(await readFile(join(here, 'input.json'), 'utf8'));
const source = {};
for (const [key, name] of [['before', 'v19-fetch-error-handler.json'], ['after', 'v19-1-fetch-error-handler.json']]) {
  source[key] = JSON.parse(await readFile(join(here, '../source', name), 'utf8'));
}
assert.equal(source.before.parameters.mode, 'runOnceForEachItem');
assert.equal(source.after.parameters.mode, source.before.parameters.mode);
assert.deepEqual({ ...source.before, parameters: { ...source.before.parameters, jsCode: null } },
  { ...source.after, parameters: { ...source.after.parameters, jsCode: null } });
const sha = value => createHash('sha256').update(value).digest('hex');
const expected = { ...input, search_html: '', public_search_error: true };
function workflow(handler) {
  const node = (name, type, parameters, x, version = 2) => ({ id: name.replaceAll(' ', '-'), name, type: `n8n-nodes-base.${type}`, typeVersion: version, position: [x, 0], parameters });
  const names = ['Manual Test Trigger', 'Synthetic Fetch Failure', handler.name, 'Verify Reproduced Handler Output', 'Reproduced Stop'];
  const connections = Object.fromEntries(names.slice(0, -1).map((name, i) => [name, { main: [[{ node: names[i + 1], type: 'main', index: 0 }]] }]));
  return {
    id: 'ReproducedHandlerOnly', name: 'REPRODUCED RECOVERY TEST / NOT HISTORICAL PRODUCTION EXECUTION', active: false,
    nodes: [node(names[0], 'manualTrigger', {}, 0, 1),
      node(names[1], 'code', { mode: 'runOnceForAllItems', jsCode: `return [{json:${JSON.stringify(input)}}];` }, 200),
      { ...node(handler.name, 'code', structuredClone(handler.parameters), 400), onError: 'stopWorkflow' },
      node(names[3], 'code', { mode: 'runOnceForEachItem', jsCode: `const expected=${JSON.stringify(expected)}; if(JSON.stringify($json)!==JSON.stringify(expected)) throw new Error('Reproduced handler output mismatch'); return {json:$json};` }, 600),
      node(names[4], 'noOp', {}, 800, 1)],
    connections, settings: { executionOrder: 'v1', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' }
  };
}
const workflows = { before: workflow(source.before), after: workflow(source.after) };
const withoutHandlerBody = value => { const v = structuredClone(value); v.nodes[2].parameters.jsCode = null; return v; };
assert.deepEqual(withoutHandlerBody(workflows.before), withoutHandlerBody(workflows.after));
await mkdir(out, { recursive: true });
const dataDir = await mkdtemp(join(tmpdir(), 'n8n-reproduced-handler-'));
// New SQLite/config directory only; no existing n8n credentials or workflows are loaded.
const env = { ...process.env, TZ: 'UTC', N8N_USER_FOLDER: dataDir, DB_TYPE: 'sqlite',
  N8N_DIAGNOSTICS_ENABLED: 'false', N8N_VERSION_NOTIFICATIONS_ENABLED: 'false', N8N_TEMPLATES_ENABLED: 'false',
  N8N_LICENSE_AUTO_RENEW_ENABLED: 'false', N8N_LICENSE_SERVER_URL: 'http://127.0.0.1:9',
  N8N_RUNNERS_ENABLED: 'false', N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true',
  N8N_ENCRYPTION_KEY: 'synthetic-local-reproduction-only-no-credentials', EXECUTIONS_DATA_PRUNE: 'false',
  N8N_COMMUNITY_PACKAGES_ENABLED: 'false', N8N_PERSONALIZATION_ENABLED: 'false' };
delete env.NODE_FUNCTION_ALLOW_EXTERNAL;
delete env.NODE_FUNCTION_ALLOW_BUILTIN;
function invoke(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env, cwd: here, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', x => { stdout += x; }); child.stderr.on('data', x => { stderr += x; });
    child.on('error', reject); child.on('exit', code => resolveRun({ code, stdout, stderr }));
  });
}
function executionFrom(stdout) {
  for (let i = stdout.indexOf('{'); i >= 0; i = stdout.indexOf('{', i + 1)) {
    try { const value = JSON.parse(stdout.slice(i)); if (value.data?.resultData) return value; } catch {}
    // CLI may print the saved execution JSON before an additional error trailer.
    try {
      let depth = 0, quoted = false, escaped = false;
      for (let j = i; j < stdout.length; j++) {
        const c = stdout[j];
        if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
        if (c === '"') quoted = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) {
          const value = JSON.parse(stdout.slice(i, j + 1)); if (value.data?.resultData) return value; break;
        }
      }
    } catch {}
  }
  throw new Error('No structured n8n execution result in CLI output; inspect local raw logs');
}
function savedExecution() {
  return new Promise((resolveRecord, reject) => {
    const database = new sqlite3.Database(join(dataDir, '.n8n/database.sqlite'), sqlite3.OPEN_READONLY, error => {
      if (error) return reject(error);
      database.get('SELECT e.id, e.workflowId, e.status, e.finished, e.mode, e.startedAt, e.stoppedAt, d.workflowData, d.data FROM execution_entity e JOIN execution_data d ON d.executionId=e.id ORDER BY e.id DESC LIMIT 1', (error, row) => {
        database.close();
        if (error) return reject(error);
        if (!row) return reject(new Error('No saved execution record in isolated SQLite database'));
        resolveRecord({ label: 'REPRODUCED RECOVERY TEST / NOT HISTORICAL PRODUCTION EXECUTION',
          executionId: String(row.id), workflowId: row.workflowId, status: row.status,
          finished: Boolean(row.finished), mode: row.mode, startedAt: row.startedAt, stoppedAt: row.stoppedAt,
          workflowData: JSON.parse(row.workflowData), data: parseFlatted(row.data) });
      });
    });
  });
}
const results = {};
function publicExecution(raw) {
  // Only generated stack-trace paths are replaced. The error text, payload, node state and workflow snapshot stay intact.
  return JSON.parse(JSON.stringify(raw).replaceAll(runtime, '$N8N_RUNTIME_ROOT').replaceAll(dataDir, '$ISOLATED_DATA_DIR'));
}
for (const key of ['before', 'after']) {
  const path = join(out, `${key}.workflow.json`);
  const content = JSON.stringify(workflows[key], null, 2) + '\n'; await writeFile(path, content);
  const imported = await invoke(['import:workflow', `--input=${path}`]);
  await writeFile(join(out, `${key}.import.log`), imported.stdout + imported.stderr);
  assert.equal(imported.code, 0, 'Workflow import must succeed');
  const run = await invoke(['execute', '--id=ReproducedHandlerOnly', '--rawOutput']);
  await writeFile(join(out, `${key}.raw.log`), run.stdout + run.stderr);
  const cliExecution = executionFrom(run.stdout);
  const execution = await savedExecution();
  // Read final persisted status: this pinned CLI prints a transient "running" status even after completion.
  assert.deepEqual(execution.data.resultData.runData, cliExecution.data.resultData.runData);
  assert.equal(execution.workflowData.nodes.find(n => n.name === source[key].name).parameters.jsCode, source[key].parameters.jsCode);
  const executionText = JSON.stringify(execution, null, 2) + '\n';
  await writeFile(join(out, `${key}.execution.json`), executionText);
  const publicText = JSON.stringify(publicExecution(execution), null, 2) + '\n';
  await writeFile(join(out, `${key}.public.execution.json`), publicText);
  const rd = execution.data.resultData;
  const nodeResults = Object.entries(rd.runData).map(([name, values]) => ({ name, status: values.at(-1).executionStatus,
    item_count: values.at(-1).data?.main?.flat().length || 0 }));
  results[key] = { workflow_sha256: sha(content), handler_code_sha256: sha(source[key].parameters.jsCode),
    original_execution_sha256: sha(executionText), published_execution_sha256: sha(publicText),
    process_exit_code: run.code, cli_reported_status: cliExecution.status,
    execution_id: execution.executionId,
    started_at: execution.startedAt, stopped_at: execution.stoppedAt, status: execution.status,
    finished: execution.finished, last_node: rd.lastNodeExecuted, error: rd.error ? { message: rd.error.message, description: rd.error.description, node: rd.error.node?.name } : null,
    node_results: nodeResults, handler_output: rd.runData[source[key].name]?.at(-1).data?.main?.[0]?.[0]?.json || null,
    embedded_workflow_handler_code: execution.workflowData?.nodes?.find(n => n.name === source[key].name)?.parameters?.jsCode || null };
  console.log(JSON.stringify({ phase: key, status: execution.status, finished: execution.finished, last_node: rd.lastNodeExecuted, error: results[key].error }));
}
assert.equal(results.before.status, 'error'); assert.equal(results.before.last_node, source.before.name);
assert.ok(results.before.error?.message); assert.equal(results.after.status, 'success'); assert.equal(results.after.finished, true);
assert.equal(results.after.last_node, 'Reproduced Stop'); assert.deepEqual(results.after.handler_output, expected);
const sourceManifest = JSON.parse(await readFile(join(here, '../recovery-source-manifest.json'), 'utf8'));
const lock = await readFile(join(here, 'package-lock.json'));
const runtimeLock = JSON.parse(await readFile(join(runtime, 'package-lock.json')));
const canonicalLock = JSON.parse(lock);
for (const [path, definition] of Object.entries(canonicalLock.packages)) {
  if (path) assert.deepEqual(runtimeLock.packages[path], definition, `Installed runtime lock differs at ${path}`);
}
const report = { label: 'REPRODUCED RECOVERY TEST', historical_production_execution: false,
  generated_at: new Date().toISOString(), scope: 'Isolated five-node synthetic workflow; archived handler body/mode only. Historical downstream aggregator/provider/email nodes are not executed.',
  environment: { n8n: n8nInfo.version, node: process.version, platform: process.platform, runners_enabled: false,
    package_lock_sha256: sha(lock) }, harness_sha256: sha(await readFile(fileURLToPath(import.meta.url))),
  evidence_baseline_commit: 'eadbf25b5486ea0c2ac7cc555e703471736c6e74',
  input_sha256: sha(await readFile(join(here, 'input.json'))), input,
  source_artifacts: sourceManifest.artifacts.slice(0, 2), only_changed_workflow_field: 'nodes[2].parameters.jsCode',
  privacy: 'Synthetic input and generated execution IDs only; runtime/data-directory paths in captured stack traces are replaced. Error text, payload, workflow snapshot and node statuses are unchanged.',
  runtime_validation: {
    n8n_nodes_base: require('n8n-nodes-base/package.json').version,
    javascript_sandbox_sha256: sha(await readFile(join(dirname(require.resolve('n8n-nodes-base/package.json')), 'dist/nodes/Code/JavaScriptSandbox.js'))),
    sandbox_sha256: sha(await readFile(join(dirname(require.resolve('n8n-nodes-base/package.json')), 'dist/nodes/Code/Sandbox.js')))
  }, results };
await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Reproduction verified: archived before errors; historical one-line correction succeeds with identical synthetic input.');
