'use strict';

const crypto = require('node:crypto');

const SUPPRESSED_STATUSES = new Set([
  'unsubscribed',
  'do_not_contact',
  'bounced',
  'final_rejection',
]);

const ALLOWED_INTENTS = new Set(['qualified', 'nurture', 'unknown']);

function normalizeLead(input = {}) {
  return {
    id: String(input.id || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    region: String(input.region || '').trim().toUpperCase(),
    status: String(input.status || '').trim().toLowerCase(),
    source: String(input.source || 'unknown').trim().toLowerCase(),
    message: String(input.message || '').trim(),
  };
}

function validateLead(lead) {
  const errors = [];

  if (!lead.id) errors.push('id_required');
  if (!lead.email || !/^\S+@\S+\.\S+$/.test(lead.email)) {
    errors.push('valid_email_required');
  }
  if (!lead.region) errors.push('region_required');

  return errors;
}

function buildIdempotencyKey(lead) {
  return crypto
    .createHash('sha256')
    .update(`${lead.id}|${lead.email}|${lead.source}`)
    .digest('hex');
}

function classificationIsValid(classification) {
  return Boolean(
    classification &&
      ALLOWED_INTENTS.has(classification.intent) &&
      Number.isFinite(classification.confidence) &&
      classification.confidence >= 0 &&
      classification.confidence <= 1,
  );
}

function chooseRoute(classification, confidenceThreshold) {
  if (!classificationIsValid(classification)) {
    return { route: 'manual_review', reason: 'invalid_classification' };
  }

  if (classification.confidence < confidenceThreshold) {
    return { route: 'manual_review', reason: 'low_confidence' };
  }

  if (classification.intent === 'qualified') {
    return { route: 'sales_queue', reason: 'qualified_intent' };
  }

  if (classification.intent === 'nurture') {
    return { route: 'nurture_queue', reason: 'nurture_intent' };
  }

  return { route: 'manual_review', reason: 'unknown_intent' };
}

async function withRetry(operation, options = {}) {
  const maxAttempts = Math.min(Math.max(options.maxAttempts || 3, 1), 5);
  const baseDelayMs = Math.max(options.baseDelayMs ?? 100, 0);
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}

async function processLead(input, deps, config = {}) {
  if (!deps || typeof deps.classifier !== 'function' || typeof deps.writeAction !== 'function') {
    throw new TypeError('classifier and writeAction dependencies are required');
  }

  const lead = normalizeLead(input);
  const validationErrors = validateLead(lead);
  const allowedRegions = new Set(config.allowedRegions || ['NC', 'SC']);
  const confidenceThreshold = config.confidenceThreshold ?? 0.75;
  const seenKeys = deps.seenKeys || new Set();
  const idempotencyKey = buildIdempotencyKey(lead);

  if (validationErrors.length) {
    return {
      status: 'blocked',
      reason: 'validation_failed',
      validationErrors,
      idempotencyKey,
    };
  }

  if (SUPPRESSED_STATUSES.has(lead.status)) {
    return {
      status: 'blocked',
      reason: 'suppressed_status',
      idempotencyKey,
    };
  }

  if (!allowedRegions.has(lead.region)) {
    return {
      status: 'blocked',
      reason: 'region_not_allowed',
      idempotencyKey,
    };
  }

  if (seenKeys.has(idempotencyKey)) {
    return {
      status: 'duplicate',
      reason: 'idempotency_key_seen',
      idempotencyKey,
    };
  }

  let classification = null;
  try {
    classification = await deps.classifier(lead);
  } catch (error) {
    classification = {
      intent: 'unknown',
      confidence: 0,
      error: error instanceof Error ? error.message : 'classifier_failed',
    };
  }

  const decision = chooseRoute(classification, confidenceThreshold);
  const action = {
    idempotencyKey,
    lead: {
      id: lead.id,
      email: lead.email,
      region: lead.region,
      source: lead.source,
    },
    classification,
    route: decision.route,
    reason: decision.reason,
  };

  await withRetry(() => deps.writeAction(action), config.retry);
  seenKeys.add(idempotencyKey);

  return {
    status: 'accepted',
    route: decision.route,
    reason: decision.reason,
    idempotencyKey,
  };
}

module.exports = {
  buildIdempotencyKey,
  chooseRoute,
  normalizeLead,
  processLead,
  validateLead,
  withRetry,
};
