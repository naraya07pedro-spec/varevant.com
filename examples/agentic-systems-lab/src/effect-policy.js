export const EFFECT_CLASS = Object.freeze({
  READ: 'READ',
  DRAFT: 'DRAFT',
  WRITE_REVERSIBLE: 'WRITE_REVERSIBLE',
  WRITE_EXTERNAL: 'WRITE_EXTERNAL',
});

export function decideEffectPolicy(input) {
  const effect = input?.effect;
  const confidence = Number(input?.confidence ?? 0);
  const hasVerifiedTarget = Boolean(input?.hasVerifiedTarget);
  const explicitlyApproved = Boolean(input?.explicitlyApproved);

  if (!Object.values(EFFECT_CLASS).includes(effect)) return { action: 'REJECT', reason: 'UNKNOWN_EFFECT_CLASS' };
  if (effect === EFFECT_CLASS.READ) return { action: 'ALLOW', reason: 'READ_ONLY' };
  if (effect === EFFECT_CLASS.DRAFT) return confidence >= 0.6
    ? { action: 'ALLOW', reason: 'DRAFT_ONLY' }
    : { action: 'REVIEW', reason: 'LOW_CONFIDENCE_DRAFT' };
  if (!hasVerifiedTarget) return { action: 'REVIEW', reason: 'TARGET_NOT_VERIFIED' };
  if (!explicitlyApproved) return { action: 'REVIEW', reason: 'HUMAN_APPROVAL_REQUIRED' };
  return { action: 'ALLOW', reason: 'APPROVED_EFFECT' };
}

export function classifyTask({ deterministic, sideEffect, ambiguity }) {
  if (deterministic && !ambiguity) return 'WORKFLOW';
  if (sideEffect) return 'AGENT_WITH_GUARDRAILS';
  return 'AGENT';
}
