import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

export const workflow = JSON.parse(readFileSync(new URL('../workflows/revenue-workflow-v6.sanitized.json', import.meta.url), 'utf8'));
export const NOW = Date.parse('2026-10-01T10:00:00Z');

// Offline context doubles for selected reviewed node bodies, not an n8n runtime.
export function runNode(name, { json = {}, items = [json], staticData = {}, executionId = 'test-execution', now = NOW } = {}) {
  const node = workflow.nodes.find(n => n.name === name);
  if (!node?.parameters?.jsCode) throw new Error(`Missing node: ${name}`);
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const input = items.map(item => ({ json: item }));
  const context = createContext({
    $json: json, $input: { all: () => input, first: () => input[0] },
    $execution: { id: executionId },
    $getWorkflowStaticData: scope => {
      if (scope !== 'global') throw new Error('Only the selected global-data API is modeled');
      return staticData;
    },
    Date: FixedDate, URL,
  });
  const result = new Script(`(function () {\n${node.parameters.jsCode}\n})()`, { filename: name })
    .runInContext(context, { timeout: 500 });
  return JSON.parse(JSON.stringify(result));
}

export function firstResult(name, options) {
  const result = runNode(name, options);
  return Array.isArray(result) ? result[0].json : result.json;
}
