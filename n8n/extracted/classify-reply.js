// Extracted from SANITIZED historical n8n source.
// Node: Classify Reply + Commercial Action
// Mode: runOnceForEachItem
// n8n context variables are supplied by the node runner.

const x=$json;
const text=String(x.reply_text||'').trim();
if(!text) return [{json:{...x,reply_state:'NO_REPLY_TEXT',next_commercial_action:'LOG_OUTCOME_ONLY',reply_draft:'',automation_stop:false}}];
const s=text.toLowerCase();
let state='OTHER';
if(/unsubscribe|remove me|stop emailing|do not contact|don't contact/.test(s)) state='REJECTION';
else if(/not interested|no thanks|we're good|we are good|final answer is no|please don't/.test(s)) state='REJECTION';
else if(/who are you|who is this|how did you find|where did you get/.test(s)) state='WHO_ARE_YOU';
else if(/price|pricing|cost|how much|rate|budget/.test(s)) state='PRICE_REQUEST';
else if(/send (me )?(more|info|information|details)|can you send|please send|send it/.test(s)) state='SEND_INFORMATION';
else if(/what do you suggest|what would you recommend|your recommendation|what would you do/.test(s)) state='WHAT_DO_YOU_SUGGEST';
else if(/not now|later|next month|next quarter|circle back|reach out in|busy right now/.test(s)) state='NOT_NOW';
else if(/speak to|contact|reach out to|you should talk to|i'll introduce|refer/.test(s)) state='REFERRAL';
else if(/interested|sounds good|worth a look|open to|tell me more|let's talk|lets talk/.test(s)) state='INTERESTED';

const first=x.sender_name?x.sender_name.split(' ')[0]:'there';
const company=x.company_name||'your team';
const evidence=x.evidence_context||'the way inbound enquiries appear to move between intake and the next available person';
let draft=''; let action='HUMAN_REVIEW'; let stop=false; let needsInput=false;
switch(state){
 case 'WHO_ARE_YOU':
  draft=`Hi ${first} — fair question. This was cold outreach. I build lead-response workflows for independent service teams, and I reached out because of ${evidence}. I was trying to confirm whether that is a real operational gap at ${company}, not assume it is. Worth sending the small pilot outline?`;
  action='SEND_IDENTITY_AND_RETURN_TO_PAIN'; break;
 case 'INTERESTED':
  draft=`Thanks, ${first}. The pilot maps each inbound source, acknowledges the enquiry, alerts the right person, escalates anything untouched, and logs response time without replacing the current system. Which channel produces most enquiries now, and what happens when one arrives while the team is tied up?`;
  action='QUALIFY_CHANNEL_AND_CURRENT_PROCESS'; break;
 case 'SEND_INFORMATION':
  draft=`Absolutely, ${first}. I’ll send the one-page workflow map, the 14-day pilot scope, integration requirements, and the short demo. As you review it, the main question is whether the current intake path reliably acknowledges and routes every enquiry when the team is busy.`;
  action='SEND_APPROVED_PILOT_PACK'; break;
 case 'WHAT_DO_YOU_SUGGEST':
  draft=`My recommendation is to start with the smallest measurable gap: web enquiries that arrive while the team is busy. The pilot would acknowledge them, alert the right person, escalate untouched enquiries, and record response time. Which form or enquiry source should be the first one tested?`;
  action='RECOMMEND_WEB_FORM_PILOT'; break;
 case 'PRICE_REQUEST':
  if(x.approved_pricing_context){
   draft=`Thanks, ${first}. ${x.approved_pricing_context} The final scope mainly depends on the number of inbound sources and the system receiving the handoff. Which channels and CRM or field-service tool are currently involved?`;
   action='SEND_APPROVED_PRICING_CONTEXT';
  } else {
   action='NEEDS_EVAN_INPUT_PRICING'; needsInput=true;
  }
  break;
 case 'NOT_NOW':
  draft=`Understood, ${first}. I’ll leave it there. If there is a better month or operational milestone to revisit this, tell me and I’ll note that timing.`;
  action='LOG_TIMING_AND_STOP_ROUTINE_FOLLOWUP'; stop=true; break;
 case 'REJECTION':
  draft=`Understood — thanks for the clear answer. I’ll close this out and won’t continue the routine follow-up.`;
  action='SUPPRESS_ROUTINE_FOLLOWUP'; stop=true; break;
 case 'REFERRAL':
  draft=`Thanks, ${first}. What is the clearest way to reach them, and may I mention that you referred me? I won’t contact them until that route and context are clear.`;
  action='VERIFY_REFERRAL_ROUTE_AND_PERMISSION'; break;
 default:
  action='HUMAN_REVIEW';
}
return [{json:{...x,reply_state:state,next_commercial_action:action,reply_draft:draft,automation_stop:stop,needs_evan_input:needsInput}}];
