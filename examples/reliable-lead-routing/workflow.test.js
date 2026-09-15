'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildIdempotencyKey,
  normalizeLead,
  processLead,
  withRetry,
} = require('./workflow');

const baseLead = {
  id: 'lead-001',
  email: 'Buyer@Example.com',
  region: 'nc',
  status: 'new',
  source: 'website',
  message: 'I would like to discuss the service.',
};

test('normalizes lead fields deterministically', () => {
  const lead = normalizeLead(baseLead);
  assert.equal(lead.email, 'buyer@example.com');
  assert.equal(lead.region, 'NC');
  assert.equal(lead.status, 'new');
});

test('blocks suppressed contacts before classification or side effects', async () => {
  let classifierCalls = 0;
  let writes = 0;

  const result = await processLead(
    { ...baseLead, status: 'unsubscribed' },
    {
      classifier: async () => {
        classifierCalls += 1;
        return { intent: 'qualified', confidence: 0.99 };
      },
      writeAction: async () => {
        writes += 1;
      },
    },
  );

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'suppressed_status');
  assert.equal(classifierCalls, 0);
  assert.equal(writes, 0);
});

test('blocks disallowed regions before classification', async () => {
  let classifierCalls = 0;

  const result = await processLead(
    { ...baseLead, region: 'TX' },
    {
      classifier: async () => {
        classifierCalls += 1;
        return { intent: 'qualified', confidence: 0.9 };
      },
      writeAction: async () => {},
    },
  );

  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'region_not_allowed');
  assert.equal(classifierCalls, 0);
});

test('routes a high-confidence qualified lead to the sales queue', async () => {
  const actions = [];
  const seenKeys = new Set();

  const result = await processLead(
    baseLead,
    {
      seenKeys,
      classifier: async () => ({ intent: 'qualified', confidence: 0.93 }),
      writeAction: async (action) => {
        actions.push(action);
      },
    },
  );

  assert.equal(result.status, 'accepted');
  assert.equal(result.route, 'sales_queue');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].reason, 'qualified_intent');
  assert.equal(seenKeys.has(result.idempotencyKey), true);
});

test('routes low-confidence classification to manual review', async () => {
  const actions = [];

  const result = await processLead(
    baseLead,
    {
      classifier: async () => ({ intent: 'qualified', confidence: 0.4 }),
      writeAction: async (action) => actions.push(action),
    },
  );

  assert.equal(result.status, 'accepted');
  assert.equal(result.route, 'manual_review');
  assert.equal(result.reason, 'low_confidence');
  assert.equal(actions.length, 1);
});

test('prevents duplicate processing with the same idempotency key', async () => {
  const lead = normalizeLead(baseLead);
  const key = buildIdempotencyKey(lead);
  const seenKeys = new Set([key]);
  let writes = 0;

  const result = await processLead(
    baseLead,
    {
      seenKeys,
      classifier: async () => ({ intent: 'qualified', confidence: 0.95 }),
      writeAction: async () => {
        writes += 1;
      },
    },
  );

  assert.equal(result.status, 'duplicate');
  assert.equal(writes, 0);
});

test('retries bounded side effects and eventually succeeds', async () => {
  let attempts = 0;

  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('temporary failure');
      return 'ok';
    },
    {
      maxAttempts: 3,
      baseDelayMs: 0,
      sleep: async () => {},
    },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});
