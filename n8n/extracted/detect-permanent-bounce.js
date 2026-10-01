// Extracted from SANITIZED historical n8n source.
// Node: Detect Permanent Bounce
// Mode: runOnceForEachItem
// n8n context variables are supplied by the node runner.

const j=$json||{};
const norm=v=>String(v??'').trim();
const strings=[];
function walk(v,path=''){
  if(v===null||v===undefined)return;
  if(typeof v==='string'||typeof v==='number'||typeof v==='boolean'){strings.push(String(v));return;}
  if(Array.isArray(v)){for(const x of v)walk(x,path);return;}
  if(typeof v==='object'){for(const [k,x] of Object.entries(v))walk(x,`${path}.${k}`);}
}
walk(j);
const blob=strings.join('\n');
const low=blob.toLowerCase();
const fromBounce=/mailer-daemon|mail delivery subsystem|postmaster|delivery status notification/i.test(`${j.from||''} ${j.subject||''} ${blob.slice(0,5000)}`);
const reasonMatch=blob.match(/(?:^|\b)(550|551|553)(?:\b|[- ][^\n]*)|5\.1\.1|no such user(?: here)?|user unknown|address not found|mailbox unavailable|recipient does not exist|recipient.*not.*(?:found|exist)/i);
const permanent=Boolean(fromBounce&&reasonMatch);
const recipientPatterns=[
  /(?:Final-Recipient|Original-Recipient)\s*:\s*rfc822;\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  /X-Failed-Recipients\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  /(?:recipient|address|to)\s*(?:is|:|=)\s*<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i
];
let recipient='';
for(const re of recipientPatterns){const m=blob.match(re);if(m){recipient=m[1].toLowerCase();break;}}
if(!recipient){
  const emails=[...new Set((blob.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase()))];
  recipient=emails.find(e=>!/(mailer-daemon|postmaster|googlemail|sender@example\.invalid)/i.test(e))||'';
}
const reason=reasonMatch?norm(reasonMatch[0]).replace(/\s+/g,' '):'';
const bounceId=norm(j.id||j.messageId||j.message_id);
const threadId=norm(j.threadId||j.thread_id);
const lane=norm(j._bounceLane);
const account=norm(j._senderAccount);
const validLane=(lane==='LANE-A'&&account==='sender@example.invalid');
return {json:{...j,_permanentBounce:Boolean(permanent&&recipient&&validLane),bounce_recipient:recipient,bounce_reason:reason,bounce_message_id:bounceId,bounce_thread_id:threadId,bounce_lane:lane,sender_account:account,detected_at:new Date().toISOString(),_bounce_detection_reason:permanent?(recipient?'PERMANENT_BOUNCE_MATCH':'RECIPIENT_NOT_EXTRACTED'):'NOT_PERMANENT_BOUNCE'}};
