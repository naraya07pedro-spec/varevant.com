
// V8 root-audit selector: safe two-lane assignment, local-time gating,
// public-suffix-aware dedupe, stale-claim recovery, and shared 24h budget.
const rows = $input.all().map(i => i.json || {});
const norm = v => (v === undefined || v === null) ? '' : String(v).trim();
const lc = v => norm(v).toLowerCase();
const get = (row, names) => {
  const keys = Object.keys(row || {});
  for (const n of names) {
    const hit = keys.find(k => k.trim().toLowerCase() === n.toLowerCase());
    if (hit !== undefined) return row[hit];
  }
  return '';
};
const COL = {
  status:['Current Status'], email:['Official Email'], msgId:['Gmail Message ID'],
  threadId:['Gmail Thread ID'], notes:['Notes'], company:['Company'], domain:['Domain'],
  operator:['Operator / Group','Operator/Group','Operator','Group'],
  owner:['Owner or Decision Maker','Owner / Decision Maker','Decision Maker','Owner','Decision-Maker'],
  claimStatus:['Claim Status'], claimToken:['Claim Token'], claimedAt:['Claimed At'],
  senderLane:['Sender Lane'], senderAccount:['Sender Account'], convOwner:['Conversation Owner'],
  sentTs:['Sent Timestamp'], country:['Country'], nextDate:['Next Action Date']
};
const STATUS_OK=['QUEUED - SENDABLE - UNSENT','GPT-QUEUED - SENDABLE - UNSENT'];
const CLAIM_PENDING='CLAIMED - PENDING SEND';
const PER_LANE_HOURLY=25, GLOBAL_HOURLY=50;
const PER_LANE_24H=450, GLOBAL_24H=900;
const STALE_MIN=90;
const ACC={'LANE-A':'sender-2@example.invalid','LANE-B':'sender-1@example.invalid'};
const COUNTRY_TZ={
  Georgia:'Asia/Tbilisi', Belize:'America/Belize', Panama:'America/Panama',
  Kenya:'Africa/Nairobi', Namibia:'Africa/Windhoek', Barbados:'America/Barbados',
  Rwanda:'Africa/Kigali', Armenia:'Asia/Yerevan', Indonesia:'Asia/Jakarta',
  Portugal:'Europe/Lisbon', Spain:'Europe/Madrid', France:'Europe/Paris',
  Italy:'Europe/Rome', Germany:'Europe/Berlin', Austria:'Europe/Vienna',
  'United Kingdom':'Europe/London', UK:'Europe/London', Ireland:'Europe/Dublin',
  Poland:'Europe/Warsaw', Czechia:'Europe/Prague', Slovakia:'Europe/Bratislava',
  Hungary:'Europe/Budapest', Netherlands:'Europe/Amsterdam', Belgium:'Europe/Brussels',
  Denmark:'Europe/Copenhagen', Norway:'Europe/Oslo', Sweden:'Europe/Stockholm',
  Finland:'Europe/Helsinki', Greece:'Europe/Athens', Croatia:'Europe/Zagreb',
  Australia:'Australia/Sydney', 'New Zealand':'Pacific/Auckland',
  'United States':'America/New_York', USA:'America/New_York', Canada:'America/Toronto',
  Mexico:'America/Mexico_City', Brazil:'America/Sao_Paulo', Argentina:'America/Argentina/Buenos_Aires',
  Kazakhstan:'Asia/Almaty', Uzbekistan:'Asia/Tashkent', Kyrgyzstan:'Asia/Bishkek',
  Taiwan:'Asia/Taipei', 'South Korea':'Asia/Seoul', 'Hong Kong':'Asia/Hong_Kong', Macau:'Asia/Macau',
  'Sri Lanka':'Asia/Colombo', India:'Asia/Kolkata', Nepal:'Asia/Kathmandu',
  Thailand:'Asia/Bangkok', Malaysia:'Asia/Kuala_Lumpur', Singapore:'Asia/Singapore',
  Philippines:'Asia/Manila', Vietnam:'Asia/Ho_Chi_Minh', Cambodia:'Asia/Phnom_Penh',
  'South Africa':'Africa/Johannesburg', Morocco:'Africa/Casablanca', Turkey:'Europe/Istanbul',
  UAE:'Asia/Dubai', 'United Arab Emirates':'Asia/Dubai'
};
const TWO_LEVEL_SUFFIXES=new Set([
  'co.uk','org.uk','me.uk','ac.uk','gov.uk','ltd.uk','plc.uk','net.uk',
  'com.au','net.au','org.au','edu.au','gov.au','asn.au','id.au',
  'co.nz','net.nz','org.nz','ac.nz','govt.nz',
  'co.jp','ne.jp','or.jp','ac.jp','go.jp',
  'co.kr','ne.kr','or.kr','go.kr','ac.kr',
  'com.sg','net.sg','org.sg','edu.sg','gov.sg',
  'com.my','net.my','org.my','edu.my','gov.my',
  'co.za','org.za','net.za','gov.za','ac.za',
  'com.br','net.br','org.br','gov.br','com.mx','com.ar','com.tr','com.hk','com.tw','com.cn','com.ua'
]);
const FREE_MAIL=new Set([
  'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','outlook.com','hotmail.com',
  'live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me',
  'protonmail.com','gmx.com','gmx.net','mail.com','zoho.com','yandex.com','yandex.ru'
]);
const LEGAL=new Set(['incorporated','inc','llc','ltd','limited','corporation','corp','company','co','gmbh','plc','pt','cv','tbk','group','holdings','holding','sdn','bhd','pte']);
const GENERIC_ID=/^(management team|management|team|owner|owners|founder|director|general manager|manager|hotel team|reservations team|sales team|marketing team|front desk|reception|admin|administrator|staff|unknown|n\/a|na|not found|decision maker|property team|hospitality team)$/i;
function normCompany(s){
  const words=lc(s).replace(/[.,]/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().split(' ');
  return words.filter(w=>w&&!LEGAL.has(w)).join(' ').trim();
}
function normDomain(s){
  let x=lc(s).replace(/^https?:\/\//,'').replace(/^www\./,'');
  return x.split('/')[0].split('?')[0].split('#')[0].replace(/\.$/,'').trim();
}
function rootDomain(s){
  const d=normDomain(s); if(!d) return '';
  if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(d)) return d;
  const p=d.split('.').filter(Boolean); if(p.length<=2) return d;
  const last2=p.slice(-2).join('.');
  return TWO_LEVEL_SUFFIXES.has(last2) && p.length>=3 ? p.slice(-3).join('.') : last2;
}
function emailRoot(e){const p=lc(e).split('@');return p.length>1?rootDomain(p[1]):'';}
function businessRoot(domain,email){const d=rootDomain(domain);if(d&&!FREE_MAIL.has(d))return d;const e=emailRoot(email);return e&&!FREE_MAIL.has(e)?e:'';}
const GENERIC_ENTITY_WORDS=new Set(['independent','local','operation','operations','family','owner','owners','owned','run','managed','management','private','property','properties','hotel','hotels','hospitality','business','company','group','single','individual','direct','route','routed','official','team','unknown','none','not','found','n','a']);
const GENERIC_ENTITY_PHRASE=/^(?:independent(?: local| family)? operation|independent|family operation|owner[- ]run operation|owner[- ]managed|owner(?:ship)?(?: \/| and)? management|property management|hotel ownership(?: \/| and)? management|local operation|private ownership|single property|independent local operation|independent family operation|not found|unknown|none|n\/?a)$/i;
function validIdentity(v){
  const x=normCompany(v);
  if(x.length<4||GENERIC_ID.test(x)||GENERIC_ENTITY_PHRASE.test(x))return false;
  const meaningful=x.split(' ').filter(t=>t&&!GENERIC_ENTITY_WORDS.has(t)&&!/^[0-9]+$/.test(t));
  return meaningful.length>=1&&meaningful.join('').length>=3;
}
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=((h*33)+s.charCodeAt(i))>>>0;return h;}
function assignLane(key){return hashStr(key)%2===0?'LANE-A':'LANE-B';}
function laneKey(c,d,e){return businessRoot(d,e)||normCompany(c);}
function isSuppressed(notes){
  const low=lc(notes);
  return /suppression\s*[=:]\s*fail|prior-?contact\s*[=:]\s*fail|\bunsubscrib|\bbounce|\bduplicate\b|\bfinal rejection\b|active[\s-]*conversation|do[\s-]*not[\s-]*(global[\s-]*)?send|\bdnc\b/.test(low);
}
const clean=s=>norm(s).replace(/^[;\s]+|[;\s]+$/g,'').trim();
function extract(notes,startTok,endTok){const up=notes.toUpperCase();const si=up.indexOf(startTok);if(si<0)return'';const from=si+startTok.length;const ei=up.indexOf(endTok,from);return clean(ei<0?notes.slice(from):notes.slice(from,ei));}
function extractBody(notes){const up=notes.toUpperCase();const start=up.indexOf('BODY:');if(start<0)return'';let end=-1;for(const e of ['PRICE=PASS','HARD-SELL=PASS','/HUMAN=PASS']){const i=up.indexOf(e,start);if(i>=0&&(end<0||i<end))end=i;}return clean(end<0?notes.slice(start+5):notes.slice(start+5,end));}

const COPY_BANNED=[/clearer journey/i,/stronger hierarchy/i,/bringing everything together/i,/one connected journey/i,/first-screen direction/i,/authored path/i,/digital presence/i,/premium positioning/i,/elevate your brand/i,/enhance the user experience/i,/communicate your value/i,/the opportunity is/i,/I would explore/i,/could work together/i,/more tangible/i,/more ownable/i,/strengthen the emotional appeal/i,/seamless experience/i,/unlock your potential/i,/take your business to the next level/i,/I noticed your website could be improved/i,/could this reach the owner or person responsible for the brand/i,/60-second breakdown/i,/quick question/i,/business opportunity/i,/website redesign/i,/improve your website/i,/collaboration proposal/i,/let[’']s connect/i,/digital transformation/i,/increase your revenue/i,/free audit/i,/perjalanan yang lebih jelas/i,/meningkatkan pengalaman pengguna/i,/mengangkat (?:brand|merek)/i,/transformasi digital/i,/membawa bisnis ke level berikutnya/i,/audit gratis/i];
function wc(v){return norm(v).split(/\s+/).filter(Boolean).length;}
function paras(v){return String(v||'').split(/\n\s*\n/).map(norm).filter(Boolean);}
function marker(notes,key){const m=String(notes||'').match(new RegExp(`(?:^|;)\\s*${key}\\s*=\\s*([^;]*)`,'i'));return m?norm(m[1]):'';}
function validateQueuedCopy(row,notes,subject,body){
  const sw=norm(subject).replace(/[—–-]/g,' ').split(/\s+/).filter(Boolean).length;
  const bw=wc(body),ps=paras(body),qs=(String(body).match(/\?/g)||[]).length;
  const banned=COPY_BANNED.some(re=>re.test(`${subject} ${body}`));
  const company=norm(get(row,COL.company));const lowBody=lc(body);
  const fact=marker(notes,'OBSERVABLE_FACT')||marker(notes,'CORE ASSET');
  const gap=marker(notes,'COMMERCIAL_GAP')||marker(notes,'COMMERCIAL IMPLICATION')||marker(notes,'DIGITAL_GAPS');
  const consequence=marker(notes,'PLAUSIBLE_CONSEQUENCE')||(/\b(that can|that may|so |before they|harder to|adds effort|struggle to|send .* elsewhere|keep comparing)\b/i.test(body)?'BODY_SUPPORTED':'');
  const outcome=marker(notes,'BUYER_OUTCOME')||(/\b(direct booking|qualified (?:enquir|inquir|rfq)|better-prepared|more useful|buyer intent|booking intent|event request)\b/i.test(body)?'BODY_SUPPORTED':'');
  const contact=/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(norm(get(row,COL.email)));
  const trust=/\bI help\b|\bI run VAREVANT\b|\bSaya membantu\b|\bSaya menjalankan VAREVANT\b/i.test(body);
  const commercial=/\b(book|booking|enquir|inquir|rfq|project fit|procurement|reservation|package|event request|direct route|buyer|guest|pemesanan|permintaan|proyek|tamu|paket|acara|jalur langsung)\b/i.test(body);
  const hard=[];
  if(!fact)hard.push('MISSING_OBSERVABLE_FACT');if(!gap)hard.push('MISSING_COMMERCIAL_GAP');if(!consequence)hard.push('MISSING_CONSEQUENCE');if(!outcome)hard.push('MISSING_OUTCOME');if(!contact)hard.push('INVALID_EMAIL');
  if(sw<3||sw>7)hard.push('SUBJECT_WORD_COUNT');if(bw<55||bw>90)hard.push('BODY_WORD_COUNT');if(ps.length>4)hard.push('PARAGRAPHS');if(qs!==1)hard.push('CTA_COUNT');if(banned)hard.push('BANNED_PHRASE');if(!trust)hard.push('NO_TRUST_CONTEXT');if(!commercial)hard.push('NON_COMMERCIAL_COPY');if(company&&!lowBody.includes(lc(company)))hard.push('COMPANY_NOT_IN_BODY');
  const scores={evidence:fact&&gap&&consequence&&outcome&&contact?5:0,specificity:company&&lowBody.includes(lc(company))?5:3,commercial:commercial?5:0,human:!banned&&bw>=55&&bw<=90&&ps.length<=4?5:0,trust:trust?5:0,cta:qs===1&&/worth sending|would it help|should I send|perlu saya kirim|apakah membantu/i.test(body)?5:qs===1?3:0};
  const total=Object.values(scores).reduce((a,b)=>a+b,0);
  return {ok:hard.length===0&&total>=25,total,hard,scores};
}
function statusNorm(v){return norm(v).replace(/\s+/g,' ').toUpperCase();}
function canonicalQueueStatus(value){
  const s=statusNorm(value).replace(/[—–−]/g,'-').replace(/_/g,' ').replace(/\s*-\s*/g,' - ').replace(/\s+/g,' ').trim();
  const aliases=new Set(['QUEUED - SENDABLE - UNSENT','GPT - QUEUED - SENDABLE - UNSENT','GPT-QUEUED - SENDABLE - UNSENT']);
  return aliases.has(s)?'QUEUED - SENDABLE - UNSENT':s;
}
function validEmail(v){return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(norm(v));}
function parseEpoch(value){
  if(value===undefined||value===null||value==='')return NaN;
  if(typeof value==='number'){
    if(value>1e12)return value;
    if(value>1e9)return value*1000;
    if(value>20000&&value<80000)return Math.round((value-25569)*86400000);
  }
  let s=norm(value);
  if(!s)return NaN;
  if(/^\d+(?:\.\d+)?$/.test(s)){
    const n=Number(s);
    if(n>1e12)return n;
    if(n>1e9)return n*1000;
    if(n>20000&&n<80000)return Math.round((n-25569)*86400000);
  }
  const zones=[
    [/\bWIB\b/gi,'+07:00'],[/\bWITA\b/gi,'+08:00'],[/\bWIT\b/gi,'+09:00'],
    [/\bCEST\b/gi,'+02:00'],[/\bCET\b/gi,'+01:00'],[/\bBST\b/gi,'+01:00'],
    [/\bEDT\b/gi,'-04:00'],[/\bEST\b/gi,'-05:00'],[/\bCDT\b/gi,'-05:00'],
    [/\bCST\b/gi,'-06:00'],[/\bMDT\b/gi,'-06:00'],[/\bMST\b/gi,'-07:00'],
    [/\bPDT\b/gi,'-07:00'],[/\bPST\b/gi,'-08:00'],[/\bUTC\b|\bGMT\b/gi,'Z']
  ];
  for(const [re,z] of zones)s=s.replace(re,z);
  if(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(s)){
    s=s.replace(' ','T')+'+07:00';
  }else if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(s)){
    s=s+'+07:00';
  }else if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    return NaN;
  }
  const t=Date.parse(s);
  return Number.isFinite(t)?t:NaN;
}
function ageMinutes(ts){const t=parseEpoch(ts);return Number.isFinite(t)?(Date.now()-t)/60000:Infinity;}
function claimIsStale(r){
  const status=statusNorm(get(r,COL.status));
  const cs=statusNorm(get(r,COL.claimStatus));
  const ambiguous=status==='SEND-UNKNOWN - RECONCILE'||cs==='SEND OUTCOME UNKNOWN';
  return !ambiguous && status===CLAIM_PENDING && cs==='CLAIMED'
    && !norm(get(r,COL.msgId)) && !norm(get(r,COL.threadId))
    && ageMinutes(get(r,COL.claimedAt))>STALE_MIN;
}
function claimIsActive(r){
  const status=statusNorm(get(r,COL.status));
  const cs=statusNorm(get(r,COL.claimStatus));
  return status===CLAIM_PENDING && cs==='CLAIMED' && !claimIsStale(r);
}
function validTimeZone(tz){try{new Intl.DateTimeFormat('en-US',{timeZone:tz}).format(new Date());return Boolean(tz);}catch{return false;}}
function extractTimezone(row,notes){
  let tz=(notes.match(/(?:^|;)\s*(?:TIMEZONE|IANA_TIMEZONE)\s*=\s*([^;]+)/i)||[])[1]||'';
  if(!tz) tz=COUNTRY_TZ[norm(get(row,COL.country))]||'';
  return validTimeZone(norm(tz))?norm(tz):'';
}
function localParts(tz){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).reduce((a,x)=>(a[x.type]=x.value,a),{});
  return {date:`${p.year}-${p.month}-${p.day}`,weekday:p.weekday,minutes:Number(p.hour||0)*60+Number(p.minute||0)};
}
function normalizedDateOnly(v){
  const m=norm(v).match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(!m)return'';
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}
function localSendEligible(row,notes){
  const tz=extractTimezone(row,notes); if(!tz) return {ok:false,reason:'TIMEZONE_UNKNOWN'};
  const lp=localParts(tz);
  if(['Sat','Sun'].includes(lp.weekday)) return {ok:false,reason:'LOCAL_WEEKEND',tz,...lp};
  if(lp.minutes<510||lp.minutes>1048) return {ok:false,reason:'OUTSIDE_08_30_17_28_PACING_MARGIN',tz,...lp};
  const nd=normalizedDateOnly(get(row,COL.nextDate));
  if(nd&&nd>lp.date) return {ok:false,reason:'NEXT_ACTION_DATE_NOT_DUE',tz,...lp};
  return {ok:true,reason:'LOCAL_WINDOW_PASS',tz,...lp};
}
function accountMatchesLane(lane,account){return Boolean(ACC[lane]&&norm(account).toLowerCase()===ACC[lane].toLowerCase());}
const SENT_STATES=new Set(['SENT','SENT-N8N','SENT-SPARK']);
function validMasterSentEvent(r){
  const lane=norm(get(r,COL.senderLane))||norm(get(r,COL.convOwner));
  const account=norm(get(r,COL.senderAccount));
  const recipient=norm(get(r,COL.email));
  const msgId=norm(get(r,COL.msgId));
  const t=parseEpoch(get(r,COL.sentTs));
  const status=statusNorm(get(r,COL.status));
  if(!SENT_STATES.has(status)||!validEmail(recipient)||!msgId||!ACC[lane]||!accountMatchesLane(lane,account)||!Number.isFinite(t))return null;
  return {lane,account,at:new Date(t).toISOString(),epoch:t,type:'MASTER_INITIAL',row_number:norm(r.row_number),recipient,msgId};
}
function validLedgerEvent(id,r){
  const lane=norm(r?.lane),account=norm(r?.account),recipient=norm(r?.recipient),msgId=norm(r?.id||id);
  const t=parseEpoch(r?.at);
  if(!ACC[lane]||!accountMatchesLane(lane,account)||!validEmail(recipient)||!msgId||!Number.isFinite(t))return null;
  return {lane,account,at:new Date(t).toISOString(),epoch:t,type:norm(r?.type)||'LEDGER',row_number:norm(r?.row_number),recipient,msgId};
}
function budgetEventKey(rec){return rec.msgId;}
const now=Date.now();
const sd=$getWorkflowStaticData('global');
sd.varevantSendLedger=sd.varevantSendLedger||{records:{}};
const ledger=sd.varevantSendLedger.records=sd.varevantSendLedger.records||{};
for(const [k,r] of Object.entries(ledger)){
  const ev=validLedgerEvent(k,r);
  if(!ev||now-ev.epoch>36*3600000||ev.epoch-now>5*60000)delete ledger[k];
}
// V9.1 focused fix:
// Capacity is derived ONLY from verified committed Prospect Master SENT rows.
// The static ledger remains an anti-duplicate / ambiguous-send guard below,
// but it must not consume hourly/24h quota because stale runtime ledger entries
// can survive tests/retries and falsely make the selector return NO_SEND_READY.
const sentRecords=new Map();
for(const r of rows){
  const ev=validMasterSentEvent(r);
  if(ev&&now-ev.epoch<=24*3600000&&ev.epoch-now<=5*60000)sentRecords.set(budgetEventKey(ev),ev);
}
const roll24={'LANE-A':0,'LANE-B':0},roll1h={'LANE-A':0,'LANE-B':0};
let global24=0,global1h=0;
for(const r of sentRecords.values()){
  const age=now-r.epoch;
  if(age>=-5*60000&&age<=24*3600000){global24++;roll24[r.lane]++;}
  if(age>=-5*60000&&age<=3600000){global1h++;roll1h[r.lane]++;}
}
const globalRemaining=Math.max(0,Math.min(GLOBAL_HOURLY-global1h,GLOBAL_24H-global24));
const laneRemaining={
  'LANE-A':Math.max(0,Math.min(PER_LANE_HOURLY-roll1h['LANE-A'],PER_LANE_24H-roll24['LANE-A'])),
  'LANE-B':Math.max(0,Math.min(PER_LANE_HOURLY-roll1h['LANE-B'],PER_LANE_24H-roll24['LANE-B']))
};
const taken={email:new Set(),domain:new Set(),company:new Set(),operator:new Set(),owner:new Set()};
function markTaken(r){
  const e=lc(get(r,COL.email));if(e)taken.email.add(e);
  const dm=businessRoot(get(r,COL.domain),get(r,COL.email));if(dm)taken.domain.add(dm);
  const c=normCompany(get(r,COL.company));if(c)taken.company.add(c);
  const op=normCompany(get(r,COL.operator));if(validIdentity(op))taken.operator.add(op);
  const ow=normCompany(get(r,COL.owner));if(validIdentity(ow))taken.owner.add(ow);
}
for(const rec of Object.values(ledger)){
  const ev=validLedgerEvent(rec?.id||'',rec);
  if(!ev||now-ev.epoch>36*3600000)continue;
  const e=lc(ev.recipient);
  if(e){taken.email.add(e);const rd=businessRoot('',e);if(rd)taken.domain.add(rd);}
}
const CONTACTED_STATES=new Set(['SENT-N8N','SENT','SENT-SPARK','CONTACTED','QUALIFIED','ACTIVE CONVERSATION','SEND-UNKNOWN - RECONCILE']);
const SUPPRESSION_STATES=new Set(['BOUNCED - PERMANENT','BOUNCED-INVALID-ADDRESS','BOUNCE OR INVALID HOLD','UNSUBSCRIBED','FINAL REJECTION']);
for(const r of rows){
  const st=statusNorm(get(r,COL.status)),cs=statusNorm(get(r,COL.claimStatus));
  const stale=claimIsStale(r);
  const hasIds=Boolean(norm(get(r,COL.msgId))||norm(get(r,COL.threadId)));
  const activeClaim=(cs==='CLAIMED'&&!stale)||cs==='COMPLETED'||cs==='FOLLOW-UP CLAIMED'||cs==='SEND OUTCOME UNKNOWN';
  const contacted=CONTACTED_STATES.has(st)||(st===CLAIM_PENDING&&!stale);
  if(contacted||activeClaim||hasIds)markTaken(r);
  else if(SUPPRESSION_STATES.has(st)){
    const e=lc(get(r,COL.email));if(e)taken.email.add(e);
  }
}
sd.varevantBranchAContext=sd.varevantBranchAContext||{};
const branchAExecutionId=String($execution.id);
const branchARunContext=sd.varevantBranchAContext[branchAExecutionId]=sd.varevantBranchAContext[branchAExecutionId]||{};

// V10.1 focused worker-identity handoff fix.
//
// Read Prospect Master replaces the trigger/lease item with sheet rows, so
// _worker_lane is no longer present in $input by the time this selector runs.
// Do NOT depend on workflow static data as the primary identity carrier.
//
// Instead, read the lane-specific Acquire node that actually executed in THIS
// execution. Referencing the non-executed sibling is safely caught.
// Static lease lookup remains only as a fallback for compatibility.
let workerLane='';
let workerLaneSource='';

try {
  const a=$('Acquire Dispatcher Lease — LANE-A').first().json||{};
  if(a._lease_granted===true && a._worker_lane==='LANE-A'){
    workerLane='LANE-A';
    workerLaneSource='ACQUIRE_NODE_A';
  }
} catch {}

if(!workerLane){
  try {
    const b=$('Acquire Dispatcher Lease — LANE-B').first().json||{};
    if(b._lease_granted===true && b._worker_lane==='LANE-B'){
      workerLane='LANE-B';
      workerLaneSource='ACQUIRE_NODE_B';
    }
  } catch {}
}

if(!workerLane){
  const leaseA=sd.varevantDispatcherLeaseLaneA||null;
  const leaseB=sd.varevantDispatcherLeaseLaneB||null;
  workerLane=
    leaseA&&String(leaseA.execution_id)===branchAExecutionId?'LANE-A':
    leaseB&&String(leaseB.execution_id)===branchAExecutionId?'LANE-B':'';
  if(workerLane)workerLaneSource='STATIC_LEASE_FALLBACK';
}

branchARunContext.workerLane=workerLane;
branchARunContext.workerLaneSource=workerLaneSource;
branchARunContext.guardIndex={emails:[...taken.email],domains:[...taken.domain],companies:[...taken.company],builtAt:new Date().toISOString()};
branchARunContext.dataRepairs=[];
branchARunContext.copyReviews=[];
branchARunContext.runtimeCounters={
  claimed:0,gmail_success:0,send_error:0,permanent_bounce:0,ambiguous_outcome:0,
  verified_logs_written:0,pre_gmail_recovered:0,pre_gmail_recovery_errors:0
};
const repairKeys=new Set();
function queueRepair(r,reason){
  const rowNumber=norm(r?.row_number);
  if(!rowNumber)return;
  const key=`${rowNumber}|${reason}`;
  if(repairKeys.has(key))return;
  repairKeys.add(key);
  branchARunContext.dataRepairs.push({rowNumber,reason,company:norm(get(r,COL.company)),email:norm(get(r,COL.email))});
}
const copyReviewKeys=new Set();
function queueCopyReview(r,reason){
  const rowNumber=norm(r?.row_number);
  if(!rowNumber)return;
  const key=`${rowNumber}|${reason}`;
  if(copyReviewKeys.has(key))return;
  copyReviewKeys.add(key);
  branchARunContext.copyReviews.push({rowNumber,reason,company:norm(get(r,COL.company)),email:norm(get(r,COL.email))});
}
const batch={email:new Set(),domain:new Set(),company:new Set(),operator:new Set(),owner:new Set()};
const counts={
  totalRowsRead:rows.length,statusEligible:0,queueValid:0,queueInvalid:0,
  copyRefreshedRows:0,copyRefreshFailedRows:0,legacyQueuePromoted:0,legacyQueueRejected:0,timezoneUnknown:0,outsideWindow:0,localWeekend:0,notDue:0,
  missingCopyOrQa:0,copyQualityRejected:0,copyRejectReasons:{},suppressed:0,hasGmailIds:0,
  blockedByDedup:0,blockedExactEmail:0,blockedBusinessDomain:0,blockedCompany:0,
  blockedNamedOperator:0,blockedNamedOwner:0,ignoredGenericOperatorLabels:0,ignoredGenericOwnerLabels:0,
  activeClaimConflicts:0,staleClaimCandidates:0,staleClaimsReleased:0,senderOwnershipConflict:0,
  selectedLaneA:0,selectedLaneB:0,cappedByLaneA:0,cappedByLaneB:0,cappedByTotal:0,
  validSentLastHour:global1h,validSentLast24h:global24,laneASentLastHour:roll1h['LANE-A'],
  laneBSentLastHour:roll1h['LANE-B'],laneASentLast24h:roll24['LANE-A'],laneBSentLast24h:roll24['LANE-B'],
  remainingA:laneRemaining['LANE-A'],remainingB:laneRemaining['LANE-B'],globalAvailable:globalRemaining
};
const selected={'LANE-A':0,'LANE-B':0};let total=0;const out=[];
const ordered=rows.slice().sort((a,b)=>Number(a.row_number||0)-Number(b.row_number||0));

// V7: do NOT globally stop the dispatcher because another execution owns
// one active row claim. Atomic claim verification already protects each row.
// A foreign active claim is skipped per-row below; unrelated queue rows continue.
const foreignActiveClaims=rows.filter(r=>{
  if(!claimIsActive(r))return false;
  const token=norm(get(r,COL.claimToken));
  const ownerExec=(token.match(/^(\d+)-/)||[])[1]||'';
  return !ownerExec||ownerExec!==branchAExecutionId;
});
counts.overlappingDispatcherActive=foreignActiveClaims.length;
counts.foreignActiveClaimsSkipped=0;


function remainingFor(lane){return Math.max(0,laneRemaining[lane]-selected[lane]);}
for(const r of ordered){
  const status=canonicalQueueStatus(get(r,COL.status));
  const stale=claimIsStale(r);
  if(status===CLAIM_PENDING&&!stale){if(claimIsActive(r)){counts.activeClaimConflicts++;counts.foreignActiveClaimsSkipped++;}continue;}
  if(!(STATUS_OK.includes(status)||(status===CLAIM_PENDING&&stale)))continue;
  counts.statusEligible++;
  if(stale)counts.staleClaimCandidates++;
  if(r._copyRefreshed===true)counts.copyRefreshedRows++;
  if(r._copyRefreshFailed===true)counts.copyRefreshFailedRows++;
  if(r._legacyQueuePromoted===true)counts.legacyQueuePromoted++;
  if(r._legacyQueueRejected===true)counts.legacyQueueRejected++;
  const rowNumber=norm(r.row_number);
  const email=norm(get(r,COL.email)),company=norm(get(r,COL.company));
  const msgId=norm(get(r,COL.msgId)),threadId=norm(get(r,COL.threadId)),notes=norm(get(r,COL.notes));
  if(!rowNumber){counts.queueInvalid++;continue;}
  if(!company){counts.queueInvalid++;queueRepair(r,'MISSING_COMPANY');continue;}
  if(!email||!validEmail(email)){counts.queueInvalid++;queueRepair(r,!email?'MISSING_RECIPIENT':'INVALID_RECIPIENT');continue;}
  if(msgId||threadId){counts.hasGmailIds++;continue;}
  const tw=localSendEligible(r,notes);
  if(!tw.ok){
    if(tw.reason==='TIMEZONE_UNKNOWN'){counts.timezoneUnknown++;counts.queueInvalid++;queueRepair(r,'INVALID_OR_MISSING_IANA_TIMEZONE');}
    else if(tw.reason==='NEXT_ACTION_DATE_NOT_DUE')counts.notDue++;
    else if(tw.reason==='LOCAL_WEEKEND')counts.localWeekend++;
    else counts.outsideWindow++;
    continue;
  }
  const up=notes.toUpperCase(),low=notes.toLowerCase();
  if(!(up.includes('SUBJECT:')&&up.includes('BODY:')&&up.includes('PRICE=PASS')&&up.includes('HARD-SELL=PASS')&&up.includes('/HUMAN=PASS')&&/prior-?contact\s*[=:]\s*pass/.test(low)&&/suppression\s*[=:]\s*pass/.test(low))){
    counts.missingCopyOrQa++;counts.queueInvalid++;queueCopyReview(r,'SUBJECT_BODY_OR_QA_MARKER_PARSE_FAILURE');continue;
  }
  if(isSuppressed(notes)){counts.suppressed++;continue;}
  const subject=extract(notes,'SUBJECT:','BODY:'),body=extractBody(notes);
  if(!subject||!body){counts.missingCopyOrQa++;counts.queueInvalid++;queueCopyReview(r,'SUBJECT_OR_BODY_EMPTY_AFTER_PARSE');continue;}
  const copyQa=validateQueuedCopy(r,notes,subject,body);
  if(!copyQa.ok){
    counts.missingCopyOrQa++;counts.copyQualityRejected++;counts.queueInvalid++;
    for(const reason of copyQa.hard)counts.copyRejectReasons[reason]=(counts.copyRejectReasons[reason]||0)+1;
    queueCopyReview(r,`COPY_QUALITY_REJECTED:${copyQa.hard.join('+')||'SCORE_BELOW_25'}`);
    continue;
  }
  const sig={email:lc(email),domain:businessRoot(get(r,COL.domain),email),company:normCompany(company),operator:normCompany(get(r,COL.operator)),owner:normCompany(get(r,COL.owner))};
  const operatorNamed=validIdentity(sig.operator),ownerNamed=validIdentity(sig.owner);
  if(sig.operator&&!operatorNamed)counts.ignoredGenericOperatorLabels++;
  if(sig.owner&&!ownerNamed)counts.ignoredGenericOwnerLabels++;
  let dupReason='';
  if(sig.email&&(taken.email.has(sig.email)||batch.email.has(sig.email)))dupReason='EXACT_EMAIL';
  else if(sig.domain&&(taken.domain.has(sig.domain)||batch.domain.has(sig.domain)))dupReason='BUSINESS_DOMAIN';
  else if(sig.company&&(taken.company.has(sig.company)||batch.company.has(sig.company)))dupReason='COMPANY';
  else if(operatorNamed&&(taken.operator.has(sig.operator)||batch.operator.has(sig.operator)))dupReason='NAMED_OPERATOR';
  else if(ownerNamed&&(taken.owner.has(sig.owner)||batch.owner.has(sig.owner)))dupReason='NAMED_OWNER';
  if(dupReason){
    counts.blockedByDedup++;
    if(dupReason==='EXACT_EMAIL')counts.blockedExactEmail++;
    else if(dupReason==='BUSINESS_DOMAIN')counts.blockedBusinessDomain++;
    else if(dupReason==='COMPANY')counts.blockedCompany++;
    else if(dupReason==='NAMED_OPERATOR')counts.blockedNamedOperator++;
    else if(dupReason==='NAMED_OWNER')counts.blockedNamedOwner++;
    continue;
  }
  counts.queueValid++;
  if(total>=globalRemaining){counts.cappedByTotal++;continue;}
  const key=laneKey(company,get(r,COL.domain),email);
  if(!key){counts.queueInvalid++;queueRepair(r,'MISSING_STABLE_LANE_KEY');continue;}
  const explicitLane=norm(get(r,COL.convOwner))||norm(get(r,COL.senderLane));
  const explicitAccount=norm(get(r,COL.senderAccount));
  const ownerLane=ACC[explicitLane]?explicitLane:'';
  if(ownerLane&&explicitAccount&&!accountMatchesLane(ownerLane,explicitAccount)){
    counts.senderOwnershipConflict++;continue;
  }
  let lane='';

  // No worker lease = no send. This prevents the disabled old serial trigger
  // or any accidental entry path from acting as a sender.
  if(!workerLane){
    counts.senderOwnershipConflict++;
    continue;
  }

  if(ownerLane){
    // Existing sender ownership remains binding exactly as before.
    if(ownerLane!==workerLane)continue;
    if(remainingFor(workerLane)<=0){counts.senderOwnershipConflict++;continue;}
    lane=workerLane;
  }else{
    // New prospects are partitioned deterministically using the existing
    // stable hash. The two worker executions therefore get disjoint batches.
    const primaryLane=assignLane(key);

    if(primaryLane!==workerLane){
      // Only absorb the other partition when that primary lane has zero
      // capacity at selection time. Never steal from a lane that still has slots.
      if(laneRemaining[primaryLane]>0)continue;
    }

    lane=workerLane;
    if(remainingFor(lane)<=0){
      counts[lane==='LANE-A'?'cappedByLaneA':'cappedByLaneB']++;
      continue;
    }
  }
  selected[lane]++;total++;
  counts[lane==='LANE-A'?'selectedLaneA':'selectedLaneB']++;
  if(stale)counts.staleClaimsReleased++;
  for(const k of ['email','domain','company'])if(sig[k])batch[k].add(sig[k]);
  if(operatorNamed)batch.operator.add(sig.operator);
  if(ownerNamed)batch.owner.add(sig.owner);
  out.push({json:{
    row_number:r.row_number,Company:company,Domain:norm(get(r,COL.domain)),'Official Email':email,
    'Approved Subject':subject,'Approved Body':body,_bucket:'SEND-READY',
    _send:{rowNumber:r.row_number,email,subject,body,company,companyKey:sig.company,domain:norm(get(r,COL.domain)),
      rootDomain:sig.domain,lane,senderAccount:ACC[lane],timezone:tw.tz,localDate:tw.date,
      notesForClaim:notes,copyVersion:r._copyVersion||'',staleClaimRecovered:stale,
      legacyQueuePromoted:r._legacyQueuePromoted===true,legacyOriginalStatus:norm(r._legacyOriginalStatus||''),
      previousClaimToken:norm(get(r,COL.claimToken)),previousClaimedAt:norm(get(r,COL.claimedAt))}
  }});
}
counts.selectedForSend=out.length;
counts.queueDeferredLocalTime=counts.outsideWindow+counts.localWeekend+counts.notDue;
branchARunContext.diagnosticBase={
  execution_id:branchAExecutionId,queue_rows_read:rows.length,queue_valid:counts.queueValid,
  queue_invalid:counts.queueInvalid,queue_deferred_local_time:counts.queueDeferredLocalTime,
  queue_suppressed:counts.suppressed,queue_duplicate:counts.blockedByDedup,
  queue_claim_conflict:counts.activeClaimConflicts,stale_claims_released:counts.staleClaimsReleased,
  valid_sent_last_hour:global1h,valid_sent_last_24h:global24,
  lane_a_sent_last_hour:roll1h['LANE-A'],lane_b_sent_last_hour:roll1h['LANE-B'],
  lane_a_available:laneRemaining['LANE-A'],lane_b_available:laneRemaining['LANE-B'],
  global_available:globalRemaining,selected_for_send:out.length,
  sender_ownership_conflict:counts.senderOwnershipConflict,subject_body_parse_failure:counts.missingCopyOrQa,
  copy_review_required:branchARunContext.copyReviews.length,
  legacy_queue_promoted:counts.legacyQueuePromoted,
  legacy_queue_rejected:counts.legacyQueueRejected,
  condition_counts:counts
};
branchARunContext.updatedAt=new Date().toISOString();
if(out.length)return out;
let selectorRootReason='NO_VALID_RECIPIENT';
if(globalRemaining<=0)selectorRootReason='GLOBAL_CAP_REACHED';
else if(laneRemaining['LANE-A']<=0&&laneRemaining['LANE-B']<=0)selectorRootReason='LANE_CAP_REACHED';
else if(counts.statusEligible===0)selectorRootReason='NO_STATUS_ELIGIBLE_ROWS';
else if(counts.queueDeferredLocalTime>0&&counts.queueValid===0)selectorRootReason='LOCAL_TIME_DEFERRED';
else if(counts.activeClaimConflicts>0&&counts.queueValid===0)selectorRootReason='CLAIM_CONFLICT';
else if(counts.blockedByDedup>0&&counts.queueValid===0)selectorRootReason='DEDUP_BLOCKED';
else if(counts.missingCopyOrQa>0&&counts.queueValid===0)selectorRootReason='COPY_GATE_BLOCKED';
else if(counts.senderOwnershipConflict>0&&counts.queueValid===0)selectorRootReason='SENDER_OWNERSHIP_CONFLICT';
return [{json:{_bucket:'NO_SEND_READY',_send:null,_diagnostic:true,_selector_root_reason:selectorRootReason,_worker_lane:workerLane||'',_worker_lane_source:workerLaneSource||'',conditionCounts:counts,message:'No eligible initial outreach rows for this execution'}}];
