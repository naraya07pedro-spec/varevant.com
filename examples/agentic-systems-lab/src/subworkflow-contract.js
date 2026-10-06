export function validateRequest(payload, schema) {
  const missing = [];
  for (const field of schema.required ?? []) {
    if (payload?.[field] === undefined || payload?.[field] === null || payload?.[field] === '') missing.push(field);
  }
  if (missing.length) return { ok: false, error: { code: 'MISSING_FIELDS', fields: missing } };
  return { ok: true, value: payload };
}

export function childResult({ ok, data = null, error = null }) {
  if (ok) return { ok: true, data, error: null };
  return { ok: false, data: null, error: {
    code: String(error?.code ?? 'CHILD_FAILED'),
    retryable: Boolean(error?.retryable),
    message: String(error?.message ?? 'child workflow failed'),
  }};
}

export function parentDecision(result) {
  if (result?.ok) return { action: 'CONTINUE', data: result.data };
  if (result?.error?.retryable) return { action: 'RETRY_OR_FALLBACK', error: result.error };
  return { action: 'ASK_FOR_CLARIFICATION_OR_STOP', error: result?.error ?? { code: 'UNKNOWN' } };
}
