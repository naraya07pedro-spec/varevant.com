const TERMINAL_SUCCESS = new Set(['completed', 'succeeded', 'done', 'success']);
const TERMINAL_FAILURE = new Set(['failed', 'cancelled', 'canceled', 'error']);

export function normalizeStatus(status) {
  return String(status ?? '').trim().toLowerCase();
}

export function nextPollDecision({ status, attempt, maxAttempts = 12, elapsedMs = 0, maxElapsedMs = 300000 }) {
  const s = normalizeStatus(status);
  const currentAttempt = Number(attempt ?? 0);
  if (TERMINAL_SUCCESS.has(s)) return { action: 'COMPLETE', reason: 'TERMINAL_SUCCESS' };
  if (TERMINAL_FAILURE.has(s)) return { action: 'STOP', reason: 'TERMINAL_FAILURE' };
  if (currentAttempt >= maxAttempts) return { action: 'STOP', reason: 'MAX_ATTEMPTS' };
  if (elapsedMs >= maxElapsedMs) return { action: 'STOP', reason: 'DEADLINE_EXCEEDED' };
  return { action: 'WAIT_AND_POLL', reason: 'NON_TERMINAL', delayMs: Math.min(30000, 1000 * 2 ** Math.min(currentAttempt, 5)) };
}

export function classifyHttpOutcome({ statusCode, transportError = false }) {
  if (transportError) return 'RETRYABLE';
  const code = Number(statusCode);
  if ([408, 425, 429].includes(code)) return 'RETRYABLE';
  if (code >= 500 && code <= 599) return 'RETRYABLE';
  if (code >= 200 && code <= 299) return 'SUCCESS';
  if ([401, 403, 404].includes(code)) return 'PERMANENT_OR_CONFIGURATION';
  if (code >= 400 && code <= 499) return 'PERMANENT';
  return 'UNKNOWN';
}
