const ROUTES = Object.freeze({ LIGHT: 'LIGHT', TOOL: 'TOOL', REASONING: 'REASONING', LONG_CONTEXT: 'LONG_CONTEXT' });

export function chooseModelClass(task) {
  const toolUse = Boolean(task?.toolUse);
  const reasoning = Number(task?.reasoning ?? 0);
  const contextTokens = Number(task?.contextTokens ?? 0);
  const risk = Number(task?.risk ?? 0);
  if (contextTokens > 50000) return ROUTES.LONG_CONTEXT;
  if (reasoning >= 0.75 || risk >= 0.8) return ROUTES.REASONING;
  if (toolUse) return ROUTES.TOOL;
  return ROUTES.LIGHT;
}

export function routeWithBudget(task, catalog) {
  const klass = chooseModelClass(task);
  return (catalog ?? []).filter(m => m.class === klass && m.enabled !== false)
    .filter(m => !task.maxCostPer1k || Number(m.costPer1k) <= Number(task.maxCostPer1k))
    .sort((a, b) => Number(a.costPer1k) - Number(b.costPer1k))[0] ?? null;
}

export { ROUTES };
