import test from 'node:test';
import assert from 'node:assert/strict';
import { firstResult, NOW } from './node-harness.mjs';

const ex = 'test-execution';
function claimFixture() {
  const row = {
    row_number: 8, 'Current Status': 'CLAIMED - PENDING SEND',
    'Official Email': 'buyer@example.invalid', Company: 'Example Services',
    Domain: 'example.invalid', Notes: 'SUBJECT: A concrete service enquiry BODY: Synthetic approved copy PRICE=PASS',
    'Claim Status': 'claimed', 'Claim Token': `${ex}-8`,
    'Sender Lane': 'LANE-A', 'Sender Account': 'sender@example.invalid',
  };
  const staticData = { varevantBranchAContext: { [ex]: { current: { _send: { rowNumber: 8 } } } } };
  return { row, staticData };
}

test('a matching live claim passes and counts one selected action', () => {
  const { row, staticData } = claimFixture();
  const result = firstResult('Verify Claim', { items: [row], staticData });
  assert.equal(result._verify, 'ok');
  assert.equal(result._laneSentThisRun, 1);
  assert.equal(result._send.email, 'buyer@example.invalid');
});

for (const [field, value, reason] of [
  ['Claim Token', 'another-execution-8', 'CLAIM_TOKEN_MISMATCH'],
  ['Claim Status', 'completed', 'CLAIM_STATUS_NOT_CLAIMED'],
  ['Current Status', 'SENT', 'STATUS_NOT_PENDING_SEND'],
  ['Gmail Message ID', 'synthetic-message', 'GMAIL_ID_ALREADY_PRESENT'],
  ['Official Email', '', 'LIVE_ROW_MISSING_EMAIL_OR_COPY'],
]) test(`claim aborts when ${field} changes`, () => {
  const { row, staticData } = claimFixture(); row[field] = value;
  const result = firstResult('Verify Claim', { items: [row], staticData });
  assert.equal(result._verify, 'abort'); assert.equal(result._reason, reason);
});

test('a missing frozen context cannot become sendable', () => {
  assert.equal(firstResult('Verify Claim', { items: [] })._reason, 'NO_FROZEN_ROW_CONTEXT');
});
test('payload fingerprint mismatch aborts before send', () => {
  const { row, staticData } = claimFixture();
  staticData.varevantBranchAContext[ex].fingerprint = 'different-approved-payload';
  assert.equal(firstResult('Verify Claim', { items: [row], staticData })._reason, 'FROZEN_PAYLOAD_MISMATCH');
});
test('a competing recipient is blocked', () => {
  const { row, staticData } = claimFixture();
  staticData.varevantBranchAContext[ex].guardIndex = { emails: ['buyer@example.invalid'] };
  assert.equal(firstResult('Verify Claim', { items: [row], staticData })._reason, 'COMPETING_EMAIL');
});

function commitFixture() {
  const rec = { row_number: 8, id: 'synthetic-message', threadId: 'synthetic-thread' };
  const json = { row_number: 8, 'Current Status': 'SENT', 'Claim Status': 'COMPLETED',
    'Gmail Message ID': rec.id, 'Gmail Thread ID': rec.threadId,
    'Sender Lane': 'LANE-A', 'Sender Account': 'sender@example.invalid' };
  return { json, staticData: { varevantBranchAContext: { [ex]: { success: { 'LANE-A': rec } } } } };
}
test('SENT commit matches the row and stored provider result', () => {
  assert.equal(firstResult('Verify SENT Commit (LANE-A)', commitFixture())._sheet_commit_ok, true);
});
for (const [field, value] of [['row_number', 9], ['Gmail Message ID', 'different-message'],
  ['Gmail Thread ID', 'different-thread'], ['Sender Account', 'other@example.invalid']])
  test(`SENT commit rejects mismatched ${field}`, () => {
    const fixture = commitFixture(); fixture.json[field] = value;
    assert.equal(firstResult('Verify SENT Commit (LANE-A)', fixture)._sheet_commit_ok, false);
  });
test('SENT commit needs a success record', () => {
  assert.equal(firstResult('Verify SENT Commit (LANE-A)', { json: commitFixture().json })._sheet_commit_ok, false);
});

test('ambiguous provider timeout is held for reconciliation', () => {
  const result = firstResult('Handle Send Error (LANE-A)', { json: { error: 'Socket timed out after request', _send: { rowNumber: 8 } } });
  assert.equal(result._classification, 'AMBIGUOUS_OUTCOME');
  assert.equal(result._requiresReconcile, true);
  assert.equal(result._currentStatus, 'SEND-UNKNOWN - RECONCILE');
});
test('permanent recipient error produces a stop marker', () => {
  const result = firstResult('Handle Send Error (LANE-A)', { json: { error: '550 5.1.1 user unknown' } });
  assert.equal(result._currentStatus, 'BOUNCED - PERMANENT');
  assert.match(result._suppressionMarker, /SUPPRESSION=ACTIVE/);
});
test('sender quota failure halts the lane for this run', () => {
  const staticData = {};
  const result = firstResult('Handle Send Error (LANE-A)', { json: { error: 'quota exceeded' }, staticData });
  assert.equal(result._senderHalt, true);
  assert.equal(staticData.__run[ex]['LANE-A'].halt, true);
});

const bounce = { from: 'mailer-daemon@example.invalid', subject: 'Delivery status notification',
  text: 'Final-Recipient: rfc822; buyer@example.invalid\n550 5.1.1 user unknown',
  _bounceLane: 'LANE-A', _senderAccount: 'sender@example.invalid', id: 'synthetic-bounce' };
test('permanent bounce needs a notification, recipient and matching lane account', () => {
  const result = firstResult('Detect Permanent Bounce', { json: bounce });
  assert.equal(result._permanentBounce, true);
  assert.equal(result.bounce_recipient, 'buyer@example.invalid');
});
test('bounce fallback excludes the synthetic sender identity', () => {
  const result = firstResult('Detect Permanent Bounce', { json: {
    ...bounce, text: 'sender@example.invalid\nbuyer@example.invalid\n550 user unknown',
  } });
  assert.equal(result.bounce_recipient, 'buyer@example.invalid');
});
for (const [field, value] of [['from', 'human@example.invalid'], ['_senderAccount', 'other@example.invalid']])
  test(`bounce control rejects mismatched ${field}`, () => {
    const json = { ...bounce, [field]: value };
    if (field === 'from') { json.subject = 'Hello'; json.text = '550 buyer@example.invalid'; }
    assert.equal(firstResult('Detect Permanent Bounce', { json })._permanentBounce, false);
  });

test('reply opt-out produces a stop action', () => {
  const result = firstResult('Classify Reply + Commercial Action', { json: { reply_text: 'Please remove me and stop emailing.' } });
  assert.equal(result.automation_stop, true);
  assert.equal(result.next_commercial_action, 'SUPPRESS_ROUTINE_FOLLOWUP');
});
test('unknown reply requires human review', () => {
  assert.equal(firstResult('Classify Reply + Commercial Action', { json: { reply_text: 'This needs some context.' } }).next_commercial_action, 'HUMAN_REVIEW');
});

test('malformed model draft falls back to deterministic copy and holds invalid fallback', () => {
  const result = firstResult('Specificity + Factuality + Copy Gate', { json: {
    copy_generation: { fallback_subject: 'Service enquiry routing', fallback_body: 'Too short.' },
    message: { content: '{not-json' }, policy: { prohibited_copy: [] },
    company: { name: 'Example Services' }, evidence_summary: { primary_evidence: { fact: 'Synthetic observed form', source_url: 'https://example.invalid/form' } },
  } });
  assert.equal(result.copy_validation.source, 'DETERMINISTIC_REPAIR');
  assert.equal(result.current_status, 'REVIEW');
  assert.equal(result.next_action, 'HUMAN_COPY_REVIEW');
});

test('lease blocks another owner within one shared synthetic state', () => {
  const staticData = {};
  assert.equal(firstResult('Acquire Dispatcher Lease', { staticData })._lease_granted, true);
  assert.equal(firstResult('Acquire Dispatcher Lease', { staticData, executionId: 'other-execution', now: NOW + 1000 })._lease_granted, false);
});
test('known concurrency limitation: independent state snapshots both grant the lease', () => {
  assert.equal(firstResult('Acquire Dispatcher Lease', { staticData: {} })._lease_granted, true);
  assert.equal(firstResult('Acquire Dispatcher Lease', { staticData: {}, executionId: 'other-execution' })._lease_granted, true);
});
