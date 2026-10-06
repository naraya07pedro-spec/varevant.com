import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, childResult, parentDecision } from '../src/subworkflow-contract.js';

test('missing child workflow inputs fail closed', () => {
  assert.deepEqual(validateRequest({ email: 'a@b.com' }, { required: ['email', 'subject'] }), { ok: false, error: { code: 'MISSING_FIELDS', fields: ['subject'] } });
});
test('retryable child error is surfaced to parent', () => {
  const result = childResult({ ok: false, error: { code: 'RATE_LIMIT', retryable: true, message: '429' } });
  assert.equal(parentDecision(result).action, 'RETRY_OR_FALLBACK');
});
test('permanent child error stops or asks for clarification', () => {
  const result = childResult({ ok: false, error: { code: 'BAD_INPUT', retryable: false, message: 'missing address' } });
  assert.equal(parentDecision(result).action, 'ASK_FOR_CLARIFICATION_OR_STOP');
});
