import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { workflow } from './node-harness.mjs';

const text = readFileSync(new URL('../workflows/revenue-workflow-v6.sanitized.json', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../source-manifest.json', import.meta.url), 'utf8'));

test('historical graph has unique node identities and no dangling connection', () => {
  const names = new Set(workflow.nodes.map(n => n.name));
  assert.equal(names.size, workflow.nodes.length);
  assert.equal(new Set(workflow.nodes.map(n => n.id)).size, workflow.nodes.length);
  let edges = 0;
  for (const [source, channels] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), source);
    for (const outputs of Object.values(channels)) for (const output of outputs) for (const edge of output) {
      assert.ok(names.has(edge.node), edge.node); edges++;
      assert.ok(Number.isInteger(edge.index) && edge.index >= 0);
    }
  }
  assert.equal(edges, manifest.edgeCount);
  assert.equal(workflow.nodes.length, manifest.nodeCount);
});
test('all original Code-node bodies compile as JavaScript', () => {
  const codeNodes = workflow.nodes.filter(n => n.type.endsWith('.code'));
  assert.equal(codeNodes.length, manifest.codeNodeCount);
  for (const node of codeNodes) assert.doesNotThrow(() => new Script(`(async function(){\n${node.parameters.jsCode}\n})`), node.name);
});
test('review export is inactive with no credentials, execution data or live resource locators', () => {
  assert.equal(workflow.active, false); assert.deepEqual(workflow.pinData, {});
  for (const key of ['id', 'versionId', 'staticData', 'meta']) assert.ok(!(key in workflow));
  for (const node of workflow.nodes) {
    assert.ok(!('credentials' in node)); assert.ok(!('webhookId' in node));
    if (/\.(gmail|googleSheets|httpRequest|webhook|respondToWebhook|scheduleTrigger)$/.test(node.type)) assert.equal(node.disabled, true, node.name);
  }
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (value.__rl && typeof value.value === 'string' && !value.value.startsWith('=')) assert.equal(value.value, 'REDACTED_RESOURCE_ID');
    for (const child of Object.values(value)) walk(child);
  };
  walk(workflow);
  assert.doesNotMatch(text, /AIza[\w-]{20,}|sk-[\w-]{20,}|gh[pousr]_[\w]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
  for (const email of text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) assert.equal(email, 'sender@example.invalid');
});
test('manifest fingerprints the exact published export', () => {
  assert.equal(createHash('sha256').update(text).digest('hex'), manifest.sanitizedSha256);
});
