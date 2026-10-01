// Extracted from SANITIZED historical n8n source.
// Node: Verify Claim
// Mode: runOnceForAllItems
// n8n context variables are supplied by the node runner.

const rows = $input.all().map(i => i.json || {});
const sd = $getWorkflowStaticData('global');
const ex = String($execution.id);
const ctx = sd.varevantBranchAContext?.[ex] || {};
const guard = ctx.guardIndex || {emails:[],domains:[],companies:[]};
const current = ctx.current || {};
const expected = current._send || {};
const norm=v=>String(v??'').trim();
const lc=v=>norm(v).toLowerCase();
const get=(row,names)=>{const keys=Object.keys(row||{});for(const n of names){const k=keys.find(x=>x.trim().toLowerCase()===n.toLowerCase());if(k!==undefined)return row[k];}return'';};
const COL={status:['Current Status'],email:['Official Email'],msgId:['Gmail Message ID'],threadId:['Gmail Thread ID'],notes:['Notes'],company:['Company'],domain:['Domain'],claimStatus:['Claim Status'],claimToken:['Claim Token'],senderLane:['Sender Lane'],senderAccount:['Sender Account'],country:['Country'],market:['Market','Region'],niche:['Niche']};
const TWO=new Set(['co.uk','org.uk','me.uk','ac.uk','gov.uk','com.au','net.au','org.au','co.nz','net.nz','org.nz','co.jp','co.kr','com.sg','com.my','co.za','com.br','com.mx','com.ar','com.tr','com.hk','com.tw']);
const FREE=new Set(['gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','gmx.com','gmx.net','mail.com','zoho.com','yandex.com','yandex.ru']);
function root(str){let x=lc(str).replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split('?')[0].split('#')[0].replace(/\.$/,'');if(!x)return'';const p=x.split('.').filter(Boolean);if(p.length<=2)return x;const l=p.slice(-2).join('.');return TWO.has(l)&&p.length>=3?p.slice(-3).join('.'):l;}
function businessRoot(domain,email){const d=root(domain);if(d&&!FREE.has(d))return d;const host=lc(email).split('@')[1]||'';const e=root(host);return e&&!FREE.has(e)?e:'';}
function normCompany(v){return lc(v).replace(/[.,]/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean).join(' ');}
const clean=s=>norm(s).replace(/^[;\s]+|[;\s]+$/g,'').trim();
function extract(notes,startTok,endTok){const up=notes.toUpperCase();const si=up.indexOf(startTok);if(si<0)return'';const from=si+startTok.length;const ei=up.indexOf(endTok,from);return clean(ei<0?notes.slice(from):notes.slice(from,ei));}
function extractBody(notes){const up=notes.toUpperCase();const start=up.indexOf('BODY:');if(start<0)return'';let end=-1;for(const e of ['PRICE=PASS','HARD-SELL=PASS','/HUMAN=PASS']){const i=up.indexOf(e,start);if(i>=0&&(end<0||i<end))end=i;}return clean(end<0?notes.slice(start+5):notes.slice(start+5,end));}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
let verify='ok',reason='ok';
const rowNumber=expected.rowNumber;
const exactToken=`${ex}-${rowNumber}`;
let mine=null;
if(rowNumber===undefined||rowNumber===null||String(rowNumber).trim()===''){verify='abort';reason='NO_FROZEN_ROW_CONTEXT';}
else{
  mine=rows.find(r=>String(r.row_number)===String(rowNumber));
  if(!mine){verify='abort';reason='CLAIMED_ROW_NOT_FOUND';}
}
const lane=mine?norm(get(mine,COL.senderLane)):'';
const notes=mine?norm(get(mine,COL.notes)):'';
const email=mine?norm(get(mine,COL.email)):'';
const domain=mine?norm(get(mine,COL.domain)):'';
const company=mine?norm(get(mine,COL.company)):'';
const subject=mine?extract(notes,'SUBJECT:','BODY:'):'';
const body=mine?extractBody(notes):'';
const senderAccount=mine?norm(get(mine,COL.senderAccount)):'';
const liveFingerprint=hash([norm(rowNumber),lc(email),subject,body,company,lane,senderAccount].join('|'));
const s={rowNumber,email,subject,body,company,companyKey:normCompany(company),domain,rootDomain:businessRoot(domain,email),lane,senderAccount,country:mine?norm(get(mine,COL.country)):'',market:mine?norm(get(mine,COL.market)):'',niche:mine?norm(get(mine,COL.niche)):'',sourceFingerprint:liveFingerprint};
sd.__run=sd.__run||{};
const run=sd.__run[ex]=sd.__run[ex]||{'LANE-A':{sent:0,halt:false}};
if(verify==='ok'&&lane!=='LANE-A'){verify='abort';reason='INVALID_LIVE_LANE';}
else if(verify==='ok'&&run[lane].halt){verify='abort';reason=`${lane}_HALTED`;}
else if(verify==='ok'&&run[lane].sent>=25){verify='abort';reason=`${lane}_PER_RUN_CAP_REACHED`;}
else if(verify==='ok'&&norm(get(mine,COL.claimToken))!==exactToken){verify='abort';reason='CLAIM_TOKEN_MISMATCH';}
else if(verify==='ok'&&lc(get(mine,COL.claimStatus))!=='claimed'){verify='abort';reason='CLAIM_STATUS_NOT_CLAIMED';}
else if(verify==='ok'&&norm(get(mine,COL.status))!=='CLAIMED - PENDING SEND'){verify='abort';reason='STATUS_NOT_PENDING_SEND';}
else if(verify==='ok'&&(norm(get(mine,COL.msgId))||norm(get(mine,COL.threadId)))){verify='abort';reason='GMAIL_ID_ALREADY_PRESENT';}
else if(verify==='ok'&&(!email||!subject||!body)){verify='abort';reason='LIVE_ROW_MISSING_EMAIL_OR_COPY';}
else if(verify==='ok'&&ctx.fingerprint&&liveFingerprint!==ctx.fingerprint){verify='abort';reason='FROZEN_PAYLOAD_MISMATCH';}
else if(verify==='ok'){
  const e=lc(email),d=s.rootDomain,c=s.companyKey;
  if(e&&Array.isArray(guard.emails)&&guard.emails.includes(e)){verify='abort';reason='COMPETING_EMAIL';}
  else if(d&&Array.isArray(guard.domains)&&guard.domains.includes(d)){verify='abort';reason='COMPETING_DOMAIN';}
  else if(c&&Array.isArray(guard.companies)&&guard.companies.includes(c)){verify='abort';reason='COMPETING_COMPANY';}
}
if(verify==='ok')run[lane].sent++;
return [{json:{_send:s,_verify:verify,_reason:reason,_laneSentThisRun:lane==='LANE-A'?run[lane].sent:0}}];
