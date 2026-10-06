import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAuditEvent, summarizeAudit } from '../src/observability.js';

test('audit event redacts secrets', () => {
  const event = makeAuditEvent({ workflow: 'w', executionId: 'e', tool: 'http', input: { authorization: 'Bearer x', nested: { apiKey: 'x', safe: 1 } }, outcome: 'ok' });
  assert.equal(event.input.authorization, '[REDACTED]');
  assert.equal(event.input.nested.apiKey, '[REDACTED]');
  assert.equal(event.input.nested.safe, 1);
});
test('audit summary totals usage and errors', () => {
  const events = [
    makeAuditEvent({ tokens: { prompt: 10, completion: 5 }, costUsd: 0.1 }),
    makeAuditEvent({ tokens: { prompt: 20, completion: 4 }, costUsd: 0.2, error: { category: 'HTTP', message: '500' } }),
  ];
  const summary = summarizeAudit(events);
  assert.deepEqual(summary, { executions: 2, prompt_tokens: 30, completion_tokens: 9, cost_usd: 0.30000000000000004, errors: 1 });
});
