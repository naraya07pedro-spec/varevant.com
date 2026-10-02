import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const base = new URL('../runtime-evidence/source/', import.meta.url);
const before = JSON.parse(readFileSync(new URL('v19-fetch-error-handler.json', base), 'utf8'));
const after = JSON.parse(readFileSync(new URL('v19-1-fetch-error-handler.json', base), 'utf8'));

function execute(node, input) {
  return vm.runInNewContext(`(function () { ${node.parameters.jsCode} })()`, { $json: input }, { timeout: 1000 });
}
// Narrow offline contract check, not an implementation of the n8n runner.
function requireSingleItem(result) {
  assert.ok(result && typeof result === 'object' && !Array.isArray(result), 'per-item result must be one object');
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json), 'item json must be an object');
  return JSON.parse(JSON.stringify(result.json));
}

test('the historical array return violates the single-item contract while the corrected body passes', () => {
  const input = { correlation: 'synthetic-search-1', search_html: '<stale>', error: { code: 'SYNTHETIC_TIMEOUT' } };
  assert.throws(() => requireSingleItem(execute(before, input)), /per-item result/);
  const output = requireSingleItem(execute(after, input));
  assert.deepEqual(output, { correlation: input.correlation, search_html: '', error: input.error, public_search_error: true });
  assert.equal(input.search_html, '<stale>');
  assert.equal(input.public_search_error, undefined);
});

test('fallback does not preserve stale search HTML or a false error flag across distinct items', () => {
  for (const input of [
    { correlation: 'synthetic-1', public_search_error: false, search_html: '<bad>', territory: { arm: 'example' } },
    { correlation: 'synthetic-2', search_html: null, retry_context: { attempt: 2 } },
    {},
  ]) {
    const original = structuredClone(input);
    const output = requireSingleItem(execute(after, input));
    assert.deepEqual(output, { ...original, search_html: '', public_search_error: true });
    assert.deepEqual(input, original);
  }
});

test('readable code stays equal to the archived excerpts and preserves the per-item mode and graph edge', () => {
  for (const [label, node] of [['v19', before], ['v19-1', after]]) {
    const text = readFileSync(new URL(`${label}-fetch-error-handler.js`, base), 'utf8');
    const body = text.split('\n').filter(line => !line.startsWith('//')).join('\n').trim();
    assert.equal(body, node.parameters.jsCode);
    new vm.Script(`(function () { ${body} })()`);
    assert.equal(node.parameters.mode, 'runOnceForEachItem');
  }
  assert.deepEqual(before.position, after.position);
  assert.deepEqual(before.outgoing_connections, after.outgoing_connections);
  assert.equal(before.name, after.name);
});
