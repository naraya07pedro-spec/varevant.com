function redact(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== 'object') return value;
  const secretKeys = /token|secret|password|authorization|api[_-]?key|cookie/i;
  const out = {};
  for (const [key, val] of Object.entries(value)) out[key] = secretKeys.test(key) ? '[REDACTED]' : redact(val);
  return out;
}

export function makeAuditEvent({ workflow, executionId, tool, input, outcome, tokens, costUsd, error }) {
  return {
    timestamp: new Date().toISOString(),
    workflow: String(workflow ?? 'unknown'),
    execution_id: String(executionId ?? 'unknown'),
    tool: tool ? String(tool) : null,
    input: redact(input ?? null),
    outcome: outcome ?? null,
    usage: {
      prompt_tokens: Number(tokens?.prompt ?? 0),
      completion_tokens: Number(tokens?.completion ?? 0),
      cost_usd: Number(costUsd ?? 0),
    },
    error: error ? { category: String(error.category ?? 'UNKNOWN'), message: String(error.message ?? '') } : null,
  };
}

export function summarizeAudit(events) {
  return events.reduce((acc, event) => {
    acc.executions += 1;
    acc.prompt_tokens += event.usage?.prompt_tokens ?? 0;
    acc.completion_tokens += event.usage?.completion_tokens ?? 0;
    acc.cost_usd += event.usage?.cost_usd ?? 0;
    if (event.error) acc.errors += 1;
    return acc;
  }, { executions: 0, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0, errors: 0 });
}
