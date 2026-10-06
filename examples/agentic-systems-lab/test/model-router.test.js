import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseModelClass, routeWithBudget } from '../src/model-router.js';

test('tool tasks choose tool-capable class', () => assert.equal(chooseModelClass({ toolUse: true }), 'TOOL'));
test('high-risk tasks choose reasoning class', () => assert.equal(chooseModelClass({ risk: 0.9 }), 'REASONING'));
test('long contexts choose long-context class first', () => assert.equal(chooseModelClass({ contextTokens: 60000, risk: 1 }), 'LONG_CONTEXT'));
test('router chooses cheapest enabled model within budget', () => {
  const catalog = [
    { name: 'a', class: 'TOOL', costPer1k: 0.02, enabled: true },
    { name: 'b', class: 'TOOL', costPer1k: 0.01, enabled: true },
  ];
  assert.equal(routeWithBudget({ toolUse: true, maxCostPer1k: 0.02 }, catalog).name, 'b');
});
