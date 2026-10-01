// Extracted from SANITIZED historical n8n source.
// Node: Handle Send Error (LANE-A)
// Mode: runOnceForAllItems
// n8n context variables are supplied by the node runner.

const j=$json||{};
const sd=$getWorkflowStaticData('global');
const ex=String($execution.id);
const ctx=sd.varevantBranchAContext?.[ex]||{};
const frozen=ctx.pending?JSON.parse(JSON.stringify(ctx.pending)):null;
const send={...(frozen||j._send||{}),gmailMessageId:'',gmailThreadId:''};
const norm=v=>String(v??'').trim();
const err=j.error;
const msg=typeof err==='string'?err:(err?.message||err?.description||j.message||j.description||(err?JSON.stringify(err):'Unknown Gmail send error'));
const observedGmailMessageId=norm(j.id||j.messageId||j.message_id);
const observedGmailThreadId=norm(j.threadId||j.thread_id);
const permanent=/(?:^|\b)(550|551|553)(?:\b|[- ])|5\.1\.1|no such user|user unknown|address not found|mailbox unavailable|recipient does not exist|recipient.*not.*(?:found|exist)/i.test(msg);
const senderFault=/(unauthor|invalid[_ ]?grant|invalid credentials|does not have any credentials set|credentials? (?:are )?not set|missing credentials?|forbidden|permission|insufficient|disabled|suspend|quota|rate ?limit|too many requests|throttl|exceeded|account.*blocked)/i.test(msg);
let classification='AMBIGUOUS_OUTCOME';
let claimStatus='SEND OUTCOME UNKNOWN';
let currentStatus='SEND-UNKNOWN - RECONCILE';
let nextAction='MANUAL RECONCILIATION - DO NOT AUTO-RETRY';
let senderHalt=false;
let suppressionMarker='';
if(permanent){
  classification='PERMANENT_RECIPIENT_ERROR';
  claimStatus='FAILED';
  currentStatus='BOUNCED - PERMANENT';
  nextAction='DO NOT RESEND';
  suppressionMarker='SUPPRESSION=ACTIVE; PERMANENT_BOUNCE=TRUE';
} else if(senderFault){
  classification='RETRYABLE_SENDER_CONFIG_ERROR';
  claimStatus='RETRYABLE CONFIG ERROR';
  currentStatus='QUEUED - SENDABLE - UNSENT';
  nextAction='RETRY AFTER SENDER CONFIG / QUOTA RECOVERY';
  senderHalt=true;
}
ctx.success=ctx.success||{};
ctx.pendingLog=ctx.pendingLog||{};
ctx.success['LANE-A']=null;
ctx.pendingLog['LANE-A']=null;
ctx.ambiguous=ctx.ambiguous||{};
ctx.ambiguous['LANE-A']={at:new Date().toISOString(),reason:classification,error:String(msg),frozenSend:frozen,observedGmailMessageId,observedGmailThreadId};
sd.__run=sd.__run||{};
const run=sd.__run[ex]=sd.__run[ex]||{'LANE-A':{sent:0,halt:false}};
run['LANE-A'].sent=Math.max(0,Number(run['LANE-A'].sent||0)-1);
if(senderHalt)run['LANE-A'].halt=true;
const requiresReconcile=classification==='AMBIGUOUS_OUTCOME';
return [{json:{_send:send,_frozenSend:frozen,_log_ok:false,_errorMessage:String(msg),_classification:classification,_claimStatus:claimStatus,_currentStatus:currentStatus,_nextAction:nextAction,_suppressionMarker:suppressionMarker,_senderHalt:senderHalt,_requiresReconcile:requiresReconcile,_claimToken:requiresReconcile?`${$execution.id}-${send.rowNumber}`:'',_claimedAt:requiresReconcile?new Date().toISOString():'',_notesAppend:suppressionMarker,_observedGmailMessageId:observedGmailMessageId,_observedGmailThreadId:observedGmailThreadId}}];
