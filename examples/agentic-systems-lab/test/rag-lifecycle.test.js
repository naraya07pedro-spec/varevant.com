import test from 'node:test';
import assert from 'node:assert/strict';
import { stableDocumentId, planDocumentLifecycle, buildMetadataFilter, selectRerankCandidates } from '../src/rag-lifecycle.js';

test('document identity is stable across versions', () => {
  const a = stableDocumentId({ sourceId: 'file-1', tenant: 'acme', version: 1 });
  const b = stableDocumentId({ sourceId: 'file-1', tenant: 'acme', version: 2 });
  assert.equal(a, b);
});
test('updated documents delete old vectors before re-embedding', () => {
  const plan = planDocumentLifecycle({ type: 'updated', sourceId: 'file-1', tenant: 'acme', version: 2 });
  assert.deepEqual(plan.steps, ['DELETE_OLD_VERSION', 'LOAD', 'CHUNK', 'EMBED', 'UPSERT']);
});
test('delete lifecycle only deletes by stable document id', () => {
  const plan = planDocumentLifecycle({ type: 'deleted', sourceId: 'file-1' });
  assert.deepEqual(plan.steps, ['DELETE_BY_DOCUMENT_ID']);
});
test('metadata filter uses allowlist', () => {
  assert.deepEqual(buildMetadataFilter({ client_name: 'A', rule_number: 27, prompt: 'drop table', unknown: 'x' }), { client_name: 'A', rule_number: 27 });
});
test('rerank selects highest rerank scores after vector prefilter', () => {
  const chunks = [
    { id: 'a', vectorScore: 0.9, rerankScore: 0.2 },
    { id: 'b', vectorScore: 0.8, rerankScore: 0.95 },
    { id: 'c', vectorScore: 0.7, rerankScore: 0.8 },
  ];
  assert.deepEqual(selectRerankCandidates(chunks, { initialK: 3, finalK: 2 }).map(x => x.id), ['b', 'c']);
});
