import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Script, createContext } from 'node:vm';

const sourceRoot = new URL('../incidents/sources/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', sourceRoot), 'utf8'));
const NOW = Date.parse('2026-08-07T03:00:00Z');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}
function run(name, { rows = [], json = {}, staticData = {}, lane = '' } = {}) {
  const code = readFileSync(new URL(name, sourceRoot), 'utf8');
  const context = createContext({ Date: FixedDate, Intl, URL, console,
    $json: json, $input: { all: () => rows.map(json => ({ json })) },
    $execution: { id: 'synthetic-fixture-execution' },
    $getWorkflowStaticData: () => staticData,
    $env: new Proxy({}, { get() { throw new Error('access to env vars denied'); } }),
    $: node => {
      if (lane && node === `Acquire Dispatcher Lease — ${lane}`)
        return { first: () => ({ json: { _lease_granted: true, _worker_lane: lane } }) };
      throw new Error('Synthetic non-executed node');
    },
  });
  return new Script(`(function(){\n${code}\n})()`, { filename: name }).runInContext(context, { timeout: 3000 });
}
test('incident excerpts retain recorded published hashes and compile', () => {
  for (const file of manifest.files) {
    const raw = readFileSync(new URL(file.path, sourceRoot));
    assert.equal(createHash('sha256').update(raw).digest('hex'), file.published_code_sha256);
    new Script(`(function(){\n${raw.toString('utf8')}\n})`);
  }
});
test('archived V2 policy fails when environment access is denied', () => {
  assert.throws(() => run('v2-policy.before.js'), /access to env vars denied/);
});
test('archived V3 policy completes without environment access', () => {
  const result = run('v3-policy.after.js');
  assert.ok(Array.isArray(result) && result.length > 0);
  assert.ok(result.every(item => item.json && typeof item.json === 'object'));
  assert.equal(readFileSync(new URL('v3-policy.after.js', sourceRoot), 'utf8').includes('$env'), false);
});
test('V9 no-send return shape violates its recorded per-item contract', () => {
  const result = run('v9-no-send.before.js', { json: { reason: 'EMPTY_QUEUE' } });
  assert.ok(Array.isArray(result));
  assert.equal(manifest.files.find(f => f.path === 'v9-no-send.before.js').mode, 'runOnceForEachItem');
});
test('V10 no-send path preserves context and returns one item object', () => {
  const result = run('v10-no-send.after.js', { json: { reason: 'EMPTY_QUEUE', context: 'synthetic' } });
  assert.equal(Array.isArray(result), false);
  assert.equal(result.json.context, 'synthetic');
  assert.equal(result.json.gmail_attempted, false);
  assert.equal(result.json.execution_result, 'NO_SEND');
});
function queue() {
  return Array.from({ length: 100 }, (_, i) => {
    const suffix = String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + i % 26);
    const company = `Example Fixture ${suffix}`;
    const body = `${company} publishes a booking enquiry form for its service team. The request page leaves the next owner unclear, which can add effort before a guest gets an answer. I help service teams connect qualified enquiries to a clear next action and a visible record. Would it help if I sent a short note on that handoff?`;
    return { row_number: i + 2, Company: company, Domain: `fixture-${i}.invalid`,
      'Official Email': `buyer@fixture-${i}.invalid`, Country: 'Indonesia',
      'Current Status': 'QUEUED - SENDABLE - UNSENT',
      Notes: `OBSERVABLE_FACT=Synthetic form;COMMERCIAL_GAP=Synthetic handoff;PLAUSIBLE_CONSEQUENCE=Synthetic delay;BUYER_OUTCOME=Qualified enquiries;TIMEZONE=Asia/Jakarta;SUBJECT: Booking enquiry handoff review BODY: ${body} PRICE=PASS;HARD-SELL=PASS;/HUMAN=PASS;prior-contact=PASS;suppression=PASS`,
    };
  });
}
const selected = result => result.filter(item => item.json._send);
test('V10.1 selects disjoint lane batches without static lease identity', () => {
  const rows = queue();
  const a = selected(run('v10-1-selector.after.js', { rows, lane: 'LANE-A' }));
  const b = selected(run('v10-1-selector.after.js', { rows, lane: 'LANE-B' }));
  assert.equal(a.length, 25);
  assert.equal(b.length, 25);
  const keys = items => items.map(item => String(item.json._send.rowNumber));
  const ak = new Set(keys(a));
  assert.equal(keys(b).filter(key => ak.has(key)).length, 0);
});
test('V10.1 missing worker identity still prevents selection', () => {
  const result = run('v10-1-selector.after.js', { rows: queue() });
  assert.equal(selected(result).length, 0);
  assert.equal(result[0].json._worker_lane, '');
  assert.equal(result[0].json._bucket, 'NO_SEND_READY');
});
test('V10.1 retains the execution-bound static lease fallback', () => {
  const result = run('v10-1-selector.after.js', { rows: queue(), staticData: {
    varevantDispatcherLeaseLaneA: { execution_id: 'synthetic-fixture-execution' },
  } });
  assert.equal(selected(result).length, 25);
});
