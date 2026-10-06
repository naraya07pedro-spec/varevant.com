import test from 'node:test';
import assert from 'node:assert/strict';
import { nextPollDecision, classifyHttpOutcome } from '../src/bounded-polling.js';

test('terminal success completes', () => assert.equal(nextPollDecision({ status: 'completed', attempt: 1 }).action, 'COMPLETE'));
test('terminal failure stops', () => assert.equal(nextPollDecision({ status: 'failed', attempt: 1 }).reason, 'TERMINAL_FAILURE'));
test('polling is bounded by attempts', () => assert.equal(nextPollDecision({ status: 'processing', attempt: 12, maxAttempts: 12 }).reason, 'MAX_ATTEMPTS'));
test('polling is bounded by deadline', () => assert.equal(nextPollDecision({ status: 'processing', attempt: 1, elapsedMs: 300000, maxElapsedMs: 300000 }).reason, 'DEADLINE_EXCEEDED'));
test('backoff caps at 30 seconds', () => assert.equal(nextPollDecision({ status: 'processing', attempt: 99, maxAttempts: 100 }).delayMs, 30000));
test('http outcome classification separates retryable and permanent errors', () => {
  assert.equal(classifyHttpOutcome({ statusCode: 429 }), 'RETRYABLE');
  assert.equal(classifyHttpOutcome({ statusCode: 503 }), 'RETRYABLE');
  assert.equal(classifyHttpOutcome({ statusCode: 401 }), 'PERMANENT_OR_CONFIGURATION');
  assert.equal(classifyHttpOutcome({ statusCode: 422 }), 'PERMANENT');
  assert.equal(classifyHttpOutcome({ statusCode: 204 }), 'SUCCESS');
});
