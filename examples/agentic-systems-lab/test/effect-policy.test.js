import test from 'node:test';
import assert from 'node:assert/strict';
import { decideEffectPolicy, classifyTask, EFFECT_CLASS } from '../src/effect-policy.js';

test('read-only effects are allowed', () => {
  assert.deepEqual(decideEffectPolicy({ effect: EFFECT_CLASS.READ }), { action: 'ALLOW', reason: 'READ_ONLY' });
});
test('external write requires verified target and approval', () => {
  assert.equal(decideEffectPolicy({ effect: EFFECT_CLASS.WRITE_EXTERNAL }).reason, 'TARGET_NOT_VERIFIED');
  assert.equal(decideEffectPolicy({ effect: EFFECT_CLASS.WRITE_EXTERNAL, hasVerifiedTarget: true }).reason, 'HUMAN_APPROVAL_REQUIRED');
  assert.equal(decideEffectPolicy({ effect: EFFECT_CLASS.WRITE_EXTERNAL, hasVerifiedTarget: true, explicitlyApproved: true }).action, 'ALLOW');
});
test('low-confidence drafts are reviewed', () => {
  assert.equal(decideEffectPolicy({ effect: EFFECT_CLASS.DRAFT, confidence: 0.3 }).action, 'REVIEW');
});
test('deterministic tasks stay workflows', () => {
  assert.equal(classifyTask({ deterministic: true, ambiguity: false, sideEffect: false }), 'WORKFLOW');
  assert.equal(classifyTask({ deterministic: false, ambiguity: true, sideEffect: true }), 'AGENT_WITH_GUARDRAILS');
});
