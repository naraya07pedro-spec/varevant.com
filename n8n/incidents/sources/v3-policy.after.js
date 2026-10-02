const sheetRows=$input.all().map(i=>i.json||{});

const staticData = $getWorkflowStaticData('global');
const metricTemplate = {
  discovered:0, hard_pass:0, sendable:0, review:0, rejected:0, suppressed:0,
  queued:0, delivered:0, permanent_bounce:0, invalid_contact:0,
  human_reply:0, warm_reply:0, qualified_conversation:0,
  meeting:0, pricing_request:0, proposal:0, won:0, lost:0,
  evidence_failure:0, duplicate_block:0, unsubscribe:0,
  explicit_rejection:0, active_conversation:0, prior_contact:0,
  territory_conflict:0, duplicate_contact:0
};
const ensureMetrics = (obj) => {
  if (!obj || typeof obj !== 'object') obj = {};
  for (const [k,v] of Object.entries(metricTemplate)) if (!Number.isFinite(obj[k])) obj[k]=v;
  return obj;
};

if (!staticData.engine || Number(staticData.engine.schema_version||0) < 2) {
  const old = staticData.engine || {};
  staticData.engine = {
    schema_version:2,
    run_count:Number(old.run_count||0),
    last_run_at:old.last_run_at||null,
    metrics:ensureMetrics(old.metrics||{}),
    arms:{}, filters:{}, niches:{}, reject_reasons:{}, run_stats:{},
    recent_selections:[], recent_outcomes:[], last_outcome:old.last_outcome||null
  };
}
const engine=staticData.engine;
engine.metrics=ensureMetrics(engine.metrics);
engine.arms=engine.arms||{};
engine.filters=engine.filters||{};
engine.niches=engine.niches||{};
engine.reject_reasons=engine.reject_reasons||{};
engine.run_stats=engine.run_stats||{};
engine.recent_selections=Array.isArray(engine.recent_selections)?engine.recent_selections:[];
engine.recent_outcomes=Array.isArray(engine.recent_outcomes)?engine.recent_outcomes:[];
engine.run_count += 1;
engine.last_run_at = new Date().toISOString();

const defaultTerritories = [
 {id:'TX_AUS_CORE',country:'United States',region:'Texas',region_code:'TX',corridor:'Austin–San Antonio',name:'Austin Core',cities:['Austin','West Lake Hills','Bee Cave'],timezone:'America/Chicago',tier:1},
 {id:'TX_AUS_NORTH',country:'United States',region:'Texas',region_code:'TX',corridor:'Austin–San Antonio',name:'North Austin Metro',cities:['Round Rock','Pflugerville','Hutto','Georgetown'],timezone:'America/Chicago',tier:1},
 {id:'TX_AUS_SOUTH',country:'United States',region:'Texas',region_code:'TX',corridor:'Austin–San Antonio',name:'South Austin Metro',cities:['Buda','Kyle','San Marcos','New Braunfels'],timezone:'America/Chicago',tier:1},
 {id:'TX_SA_CORE',country:'United States',region:'Texas',region_code:'TX',corridor:'Austin–San Antonio',name:'San Antonio Core',cities:['San Antonio','Alamo Heights','Helotes'],timezone:'America/Chicago',tier:1},
 {id:'TX_SA_NE',country:'United States',region:'Texas',region_code:'TX',corridor:'Austin–San Antonio',name:'Northeast San Antonio',cities:['Schertz','Cibolo','Universal City','Seguin'],timezone:'America/Chicago',tier:1},
 {id:'TX_DFW_NORTH',country:'United States',region:'Texas',region_code:'TX',corridor:'Dallas–Fort Worth',name:'North Dallas Metro',cities:['Dallas','Plano','Frisco','McKinney'],timezone:'America/Chicago',tier:2},
 {id:'TX_DFW_WEST',country:'United States',region:'Texas',region_code:'TX',corridor:'Dallas–Fort Worth',name:'Fort Worth Metro',cities:['Fort Worth','Arlington','Grapevine','Keller'],timezone:'America/Chicago',tier:2},
 {id:'TX_HOU_WEST',country:'United States',region:'Texas',region_code:'TX',corridor:'Greater Houston',name:'West Houston Metro',cities:['Houston','Katy','Sugar Land','Richmond'],timezone:'America/Chicago',tier:2},
 {id:'TX_HOU_NORTH',country:'United States',region:'Texas',region_code:'TX',corridor:'Greater Houston',name:'North Houston Metro',cities:['Spring','The Woodlands','Conroe','Tomball'],timezone:'America/Chicago',tier:2},
 {id:'TX_CENTRAL',country:'United States',region:'Texas',region_code:'TX',corridor:'Central Texas',name:'Waco–Temple–Killeen',cities:['Waco','Temple','Killeen','Belton'],timezone:'America/Chicago',tier:2},
 {id:'TX_BRAZOS',country:'United States',region:'Texas',region_code:'TX',corridor:'Brazos Valley',name:'Bryan–College Station',cities:['Bryan','College Station'],timezone:'America/Chicago',tier:3},
 {id:'TX_EAST',country:'United States',region:'Texas',region_code:'TX',corridor:'East Texas',name:'Tyler–Longview',cities:['Tyler','Longview'],timezone:'America/Chicago',tier:3},
 {id:'TX_GULF',country:'United States',region:'Texas',region_code:'TX',corridor:'Texas Gulf',name:'Corpus Christi–Victoria',cities:['Corpus Christi','Victoria'],timezone:'America/Chicago',tier:3},
 {id:'TX_RGV',country:'United States',region:'Texas',region_code:'TX',corridor:'Rio Grande Valley',name:'McAllen–Brownsville',cities:['McAllen','Edinburg','Mission','Brownsville'],timezone:'America/Chicago',tier:3},
 {id:'TX_ELP',country:'United States',region:'Texas',region_code:'TX',corridor:'West Texas',name:'El Paso',cities:['El Paso'],timezone:'America/Denver',tier:3}
];

const customTerritories=[]; // Runtime-native: built-in adaptive territory pool; no environment access.
const normalizeTerritory=(t,idx)=>({
  id:String(t.id||`CUSTOM_${idx+1}`).replace(/[^A-Za-z0-9_-]/g,'_'),
  country:String(t.country||'United States'), region:String(t.region||''), region_code:String(t.region_code||t.regionCode||''),
  corridor:String(t.corridor||t.region||'Custom Territory'), name:String(t.name||t.subterritory||t.corridor||`Custom ${idx+1}`),
  cities:Array.isArray(t.cities)?t.cities.map(String).filter(Boolean).slice(0,8):[],
  timezone:String(t.timezone||'America/Chicago'), tier:Number(t.tier||2), active:t.active!==false
});
const territoryPool=(customTerritories.length?customTerritories:defaultTerritories).map(normalizeTerritory).filter(t=>t.active&&t.region&&t.cities.length);
if(!territoryPool.length) throw new Error('No valid adaptive territory entries.');

const nicheCatalog = [
 {name:'HVAC',tier:1,terms:['HVAC','air conditioning','heating','furnace','heat pump'],pattern:'hvac|air condition|heating|furnace|heat pump',value_terms:'replacement|install|heat pump|furnace|commercial'},
 {name:'Plumbing',tier:1,terms:['plumbing','plumber','drain','sewer','water heater'],pattern:'plumb|drain|sewer|water heater|repip',value_terms:'water heater|sewer|repip|commercial|install'},
 {name:'Electrical',tier:2,terms:['electrical contractor','electrician','panel upgrade','generator'],pattern:'electric|panel upgrade|generator|rewir',value_terms:'panel|generator|rewir|commercial|install'},
 {name:'Garage Door',tier:2,terms:['garage door repair','garage door installation'],pattern:'garage door|overhead door',value_terms:'installation|replacement|commercial'},
 {name:'Roofing',tier:2,terms:['roofing contractor','roof repair','roof replacement'],pattern:'roof|roofer',value_terms:'replacement|storm|commercial|insurance'},
 {name:'Restoration',tier:2,terms:['water damage restoration','fire damage restoration','mold remediation'],pattern:'restoration|water damage|fire damage|mold remediation',value_terms:'emergency|insurance|commercial|reconstruction'}
];

const filterProfiles = {
 BALANCED:{id:'BALANCED',sendable_min:78,review_min:65,max_candidates:24,min_scale_terms:3,require_why_now:false,min_verified_evidence:2,query_mode:'balanced'},
 STRICT_SIGNAL:{id:'STRICT_SIGNAL',sendable_min:82,review_min:70,max_candidates:16,min_scale_terms:4,require_why_now:true,min_verified_evidence:3,query_mode:'strict'},
 WHY_NOW_HUNT:{id:'WHY_NOW_HUNT',sendable_min:80,review_min:68,max_candidates:20,min_scale_terms:3,require_why_now:true,min_verified_evidence:2,query_mode:'why_now'},
 CONTACT_RECOVERY:{id:'CONTACT_RECOVERY',sendable_min:80,review_min:68,max_candidates:20,min_scale_terms:3,require_why_now:false,min_verified_evidence:2,query_mode:'contact'},
 DENSITY_EXPANSION:{id:'DENSITY_EXPANSION',sendable_min:80,review_min:67,max_candidates:32,min_scale_terms:2,require_why_now:false,min_verified_evidence:2,query_mode:'density'}
};
for(const id of Object.keys(filterProfiles)) engine.filters[id]={...ensureMetrics(engine.filters[id]||{}),selected_runs:Number(engine.filters[id]?.selected_runs||0)};
for(const n of nicheCatalog) engine.niches[n.name]={...ensureMetrics(engine.niches[n.name]||{}),selected_runs:Number(engine.niches[n.name]?.selected_runs||0),last_selected_run:Number(engine.niches[n.name]?.last_selected_run||0)};
for(const t of territoryPool) engine.arms[t.id]={...ensureMetrics(engine.arms[t.id]||{}),selected_runs:Number(engine.arms[t.id]?.selected_runs||0),last_selected_run:Number(engine.arms[t.id]?.last_selected_run||0),cooldown_until_run:Number(engine.arms[t.id]?.cooldown_until_run||0)};

const m=engine.metrics;
const rate=(n,d)=>d>0?n/d:0;
const attempts=m.delivered+m.permanent_bounce;
const bounceRate=rate(m.permanent_bounce,attempts);
const hardPassRate=rate(m.hard_pass,m.discovered);
const sendableRate=rate(m.sendable,m.discovered);
const contactFailRate=rate(Number(engine.reject_reasons.NO_VERIFIED_OFFICIAL_CONTACT||0),m.discovered);
const evidenceFailRate=rate(Number(engine.reject_reasons.NO_WORKFLOW_RISK_SIGNAL||0)+Number(engine.reject_reasons.NO_DEMAND_VOLUME_SIGNAL||0)+Number(engine.reject_reasons.NO_ABILITY_TO_PAY_SIGNAL||0),m.discovered*3);
const densityPerRun=rate(m.discovered,Math.max(engine.run_count-1,1));

let filterId='BALANCED';
let filterReason='Balanced discovery and qualification are the default baseline.';
if(attempts>=20 && (bounceRate>0.03 || rate(m.invalid_contact,attempts)>0.08)){
  filterId='STRICT_SIGNAL'; filterReason='Delivery/contact health requires stricter evidence and scale filters.';
}else if(m.discovered>=20 && contactFailRate>0.30){
  filterId='CONTACT_RECOVERY'; filterReason='Official contact availability is the dominant rejection reason.';
}else if(m.discovered>=20 && evidenceFailRate>0.25){
  filterId='WHY_NOW_HUNT'; filterReason='Evidence packs are weak; discovery will prioritize fresh operational triggers.';
}else if(engine.run_count>=4 && (densityPerRun<4 || (m.discovered>=20 && sendableRate<0.08))){
  filterId='DENSITY_EXPANSION'; filterReason='Candidate density or SENDABLE yield is too low under the current filter.';
}
const recentFilters=engine.recent_selections.slice(-2).map(s=>s.filter_profile);
if(recentFilters.length===2 && recentFilters.every(x=>x===filterId) && filterId!=='STRICT_SIGNAL'){
  const rotation={BALANCED:'WHY_NOW_HUNT',WHY_NOW_HUNT:'CONTACT_RECOVERY',CONTACT_RECOVERY:'DENSITY_EXPANSION',DENSITY_EXPANSION:'BALANCED'};
  filterId=rotation[filterId]||'BALANCED';
  filterReason+=' Filter diversity rotation applied after two consecutive identical runs.';
}
const filter=filterProfiles[filterId];

const globalQualified=m.qualified_conversation||0;
const primaryNames=['HVAC','Plumbing'];
const allowSecondary=(engine.run_count>=8 && m.discovered>=40 && (sendableRate<0.10 || (m.delivered>=60 && globalQualified===0)));
const nicheCandidates=nicheCatalog.filter(n=>n.tier===1 || allowSecondary);
const totalNicheRuns=Math.max(1,nicheCandidates.reduce((a,n)=>a+(engine.niches[n.name]?.selected_runs||0),0));
const nicheScore=(n)=>{
  const s=engine.niches[n.name];
  const delivered=s.delivered||0;
  const performance=rate(s.qualified_conversation,delivered)*80+rate(s.warm_reply,delivered)*30+rate(s.sendable,s.discovered)*18+Math.min(8,rate(s.discovered,Math.max(s.selected_runs,1)));
  const exploration=Math.sqrt(Math.log(totalNicheRuns+2)/(s.selected_runs+1))*12;
  const cold=s.selected_runs===0?45:s.selected_runs===1?20:0;
  const repeat=engine.recent_selections.slice(-1).some(v=>v.niche===n.name)?8:0;
  const tierPenalty=n.tier>1?4:0;
  return performance+exploration+cold-repeat-tierPenalty;
};
const selectedNiche=[...nicheCandidates].sort((a,b)=>nicheScore(b)-nicheScore(a)||a.tier-b.tier)[0];

const totalArmRuns=Math.max(1,territoryPool.reduce((a,t)=>a+(engine.arms[t.id]?.selected_runs||0),0));
const armScore=(t)=>{
  const s=engine.arms[t.id];
  if(s.cooldown_until_run>engine.run_count) return -9999;
  const delivered=s.delivered||0;
  const attemptsArm=delivered+(s.permanent_bounce||0);
  const performance=rate(s.qualified_conversation,delivered)*100+rate(s.warm_reply,delivered)*35+rate(s.human_reply,delivered)*18+rate(s.sendable,s.discovered)*20+Math.min(10,rate(s.discovered,Math.max(s.selected_runs,1)));
  const penalties=rate(s.permanent_bounce,attemptsArm)*80+rate(s.invalid_contact,Math.max(attemptsArm,1))*35+rate(s.evidence_failure,Math.max(s.discovered,1))*25;
  const exploration=Math.sqrt(Math.log(totalArmRuns+2)/(s.selected_runs+1))*16;
  const cold=s.selected_runs===0?60:s.selected_runs===1?28:0;
  const recent=engine.recent_selections.slice(-2).some(v=>v.arm_id===t.id)?18:0;
  const tierPenalty=(t.tier-1)*3;
  return performance+exploration+cold-penalties-recent-tierPenalty;
};
let eligible=territoryPool.filter(t=>engine.arms[t.id].cooldown_until_run<=engine.run_count);
if(!eligible.length){for(const t of territoryPool) engine.arms[t.id].cooldown_until_run=0; eligible=[...territoryPool];}
const selectedTerritory=[...eligible].sort((a,b)=>armScore(b)-armScore(a)||a.tier-b.tier||a.id.localeCompare(b.id))[0];
const selectedArmStats=engine.arms[selectedTerritory.id];
const selectedAttempts=(selectedArmStats.delivered||0)+(selectedArmStats.permanent_bounce||0);
if(selectedAttempts>=20 && rate(selectedArmStats.permanent_bounce,selectedAttempts)>0.03) selectedArmStats.cooldown_until_run=engine.run_count+4;
if((selectedArmStats.discovered||0)>=20 && rate(selectedArmStats.evidence_failure,selectedArmStats.discovered)>0.25) selectedArmStats.cooldown_until_run=Math.max(selectedArmStats.cooldown_until_run,engine.run_count+2);

let territoryAction='CONTINUE';
let actionReason='Adaptive engine is still accumulating comparable evidence.';
let queueAllowed=true;
if(attempts>=20 && bounceRate>0.03){
  territoryAction='PAUSE'; actionReason='Global permanent bounce rate exceeds 3%; queue handoff is paused while discovery may continue diagnostically.'; queueAllowed=false;
}else if(m.evidence_failure>=3 && rate(m.evidence_failure,Math.max(m.discovered,1))>0.10){
  territoryAction='PAUSE'; actionReason='Evidence-quality failures exceed safe tolerance; queue handoff is paused.'; queueAllowed=false;
}else if(m.delivered>=60 && rate(m.human_reply,m.delivered)<0.02 && m.warm_reply===0){
  territoryAction='ROTATE_ANGLE'; actionReason='Human reply is below 2% after 60 delivered with no warm replies.';
}else if((selectedArmStats.delivered||0)>=30 && (selectedArmStats.qualified_conversation||0)===0 && rate(selectedArmStats.permanent_bounce,Math.max(selectedAttempts,1))<=0.02){
  territoryAction='ROTATE_TERRITORY'; actionReason='The previous territory arm reached test volume without a qualified conversation.';
}else if(m.discovered>=30 && hardPassRate<0.12){
  territoryAction='ROTATE_FILTER'; actionReason='Hard-gate pass rate is too low; filter profile has been changed.';
}else if(m.delivered>=30 && bounceRate<=0.02 && rate(m.human_reply,m.delivered)>=0.05 && rate(m.warm_reply,m.delivered)>=0.02 && m.qualified_conversation>=1){
  const winningArms=Object.values(engine.arms).filter(s=>(s.delivered||0)>=30&&rate(s.human_reply,s.delivered)>=0.05&&(s.qualified_conversation||0)>=1).length;
  territoryAction=winningArms>=2?'EXPAND':'CONTINUE';
  actionReason=winningArms>=2?'At least two territory arms meet continuation quality, supporting controlled expansion.':'Continuation thresholds are met.';
}

selectedArmStats.selected_runs+=1;
selectedArmStats.last_selected_run=engine.run_count;
engine.filters[filterId].selected_runs+=1;
engine.niches[selectedNiche.name].selected_runs+=1;
engine.niches[selectedNiche.name].last_selected_run=engine.run_count;

// Runtime-native operating mode copied from the production workflow pattern.
// Discovery uses public HTTP search pages, history uses Prospect Master, and queue handoff appends to Prospect Master.
const deliveryReady=true;       // Safe web-form response pilot only.
const missedCallReady=false;    // Telephony/missed-call automation remains prohibited until separately validated.
const runId=`VRS3-${Date.now()}-${engine.run_count}`;

const norm=v=>String(v??'').trim();
const lc=v=>norm(v).toLowerCase();
const get=(row,names)=>{const keys=Object.keys(row||{});for(const n of names){const k=keys.find(x=>x.trim().toLowerCase()===n.toLowerCase());if(k!==undefined)return row[k];}return'';};
const TWO_LEVEL_SUFFIXES=new Set(['co.uk','org.uk','me.uk','ac.uk','gov.uk','com.au','net.au','org.au','co.nz','net.nz','org.nz','co.jp','co.kr','com.sg','com.my','co.za','com.br','com.mx','com.ar','com.tr','com.hk','com.tw']);
const FREE_MAIL=new Set(['gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','gmx.com','gmx.net','mail.com','zoho.com','yandex.com','yandex.ru']);
const LEGAL=new Set(['incorporated','inc','llc','ltd','limited','corporation','corp','company','co','gmbh','plc','pt','cv','tbk','group','holdings','holding','sdn','bhd','pte']);
function normDomain(s){let x=lc(s).replace(/^https?:\/\//,'').replace(/^www\./,'');return x.split('/')[0].split('?')[0].split('#')[0].replace(/\.$/,'').trim();}
function rootDomain(s){const host=normDomain(s);if(!host)return'';const p=host.split('.').filter(Boolean);if(p.length<=2)return host;const last2=p.slice(-2).join('.');return TWO_LEVEL_SUFFIXES.has(last2)&&p.length>=3?p.slice(-3).join('.'):last2;}
function normCompany(s){return lc(s).replace(/[.,]/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(w=>w&&!LEGAL.has(w)).join(' ');}
const allEmail=new Set(),allDomain=new Set(),allCompany=new Set();
const suppressedEmail=new Set(),suppressedDomain=new Set(),suppressedCompany=new Set();
const activeEmail=new Set(),activeDomain=new Set(),activeCompany=new Set();
const blockedPattern=/unsubscrib|permanent bounce|bounced-invalid|final rejection|do not contact|do-not-contact|\bdnc\b|suppression\s*[=:]\s*fail|explicit rejection/i;
const activePattern=/active conversation|qualified|pricing request|meeting|proposal|interested|human reply|warm reply/i;
for(const row of sheetRows){
  const email=lc(get(row,['Official Email','Recipient']));
  const domain=rootDomain(get(row,['Domain','Website'])||(email.split('@')[1]||''));
  const company=normCompany(get(row,['Company']));
  const state=`${get(row,['Current Status','Send Status','Stage'])} ${get(row,['Claim Status'])} ${get(row,['Notes'])} ${get(row,['Last Action'])}`;
  if(email)allEmail.add(email);if(domain&&!FREE_MAIL.has(domain))allDomain.add(domain);if(company)allCompany.add(company);
  if(blockedPattern.test(state)){if(email)suppressedEmail.add(email);if(domain)suppressedDomain.add(domain);if(company)suppressedCompany.add(company);}
  if(activePattern.test(state)){if(email)activeEmail.add(email);if(domain)activeDomain.add(domain);if(company)activeCompany.add(company);}
}
engine.history_index={
  built_at:new Date().toISOString(),rows_read:sheetRows.length,
  emails:[...allEmail],domains:[...allDomain],companies:[...allCompany],
  suppressed_emails:[...suppressedEmail],suppressed_domains:[...suppressedDomain],suppressed_companies:[...suppressedCompany],
  active_emails:[...activeEmail],active_domains:[...activeDomain],active_companies:[...activeCompany]
};

const selectionMode=(selectedArmStats.selected_runs<=2||engine.niches[selectedNiche.name].selected_runs<=2)?'EXPLORATION':'EXPLOITATION_WITH_EXPLORATION_BONUS';
const selection={run_id:runId,run_number:engine.run_count,arm_id:selectedTerritory.id,subterritory:selectedTerritory.name,corridor:selectedTerritory.corridor,niche:selectedNiche.name,filter_profile:filterId,selected_at:new Date().toISOString()};
engine.recent_selections.push(selection);
engine.recent_selections=engine.recent_selections.slice(-20);
engine.run_stats[runId]={...selection,discovered:0,hard_pass:0,sendable:0,review:0,rejected:0,suppressed:0,reject_reasons:{}};
const runKeys=Object.keys(engine.run_stats); if(runKeys.length>60) for(const k of runKeys.slice(0,runKeys.length-60)) delete engine.run_stats[k];

const allowedNicheTerms=nicheCatalog.flatMap(n=>n.terms).map(x=>x.toLowerCase());
return [{json:{
  engine_version:'3.0.0',run_id:runId,run_started_at:new Date().toISOString(),
  play_id:'US_HOME_SERVICES_SPEED_TO_LEAD_ADAPTIVE_V3',
  active_play:{
    country:selectedTerritory.country,region:selectedTerritory.region,region_code:selectedTerritory.region_code,corridor:selectedTerritory.corridor,
    territory_id:selectedTerritory.id,subterritory:selectedTerritory.name,cities:selectedTerritory.cities,timezone:selectedTerritory.timezone,
    niches:[selectedNiche.name],niche:selectedNiche,
    company_scale:filterId==='DENSITY_EXPANSION'?'Independent multi-person operator with at least two scale proxies':'Independent service company with multi-crew or equivalent operating-scale proxies',
    primary_buyer:['Owner','Founder','Operations Manager','General Manager','Service Manager','Customer Service Manager'],
    service_route:'SPEED_TO_LEAD',entry_offer:missedCallReady?'14-Day Lead Response Pilot':'14-Day Web-Form Response Pilot',core_offer:'Lead-to-Booked-Job Workflow Integration'
  },
  adaptive_context:{
    enabled:true,arm_id:selectedTerritory.id,filter_profile:filterId,filter_reason:filterReason,niche:selectedNiche.name,
    selection_mode:selectionMode,territory_pool_size:territoryPool.length,niche_pool_size:nicheCandidates.length,
    secondary_niches_enabled:allowSecondary,territory_score:Number(armScore(selectedTerritory).toFixed(3)),niche_score:Number(nicheScore(selectedNiche).toFixed(3)),
    selected_arm_metrics:{...selectedArmStats},selected_filter_metrics:{...engine.filters[filterId]},selected_niche_metrics:{...engine.niches[selectedNiche.name]}
  },
  territory_decision:{action:territoryAction,reason:actionReason,queue_allowed:queueAllowed,metrics_snapshot:{...m},selected_arm:selectedTerritory.id},
  policy:{
    sendable_min:filter.sendable_min,review_min:filter.review_min,max_results_per_query:8,max_candidates_per_run:filter.max_candidates,
    filter_profile:filterId,query_mode:filter.query_mode,min_scale_terms:filter.min_scale_terms,require_why_now:filter.require_why_now,min_verified_evidence:filter.min_verified_evidence,
    min_signal_counts:{demand:1,workflow:1,pay:1},allowed_niches:allowedNicheTerms,niche_catalog:nicheCatalog,
    prohibited_copy:['AI integration','agentic AI','digital transformation','revolutionize','streamline your business','unlock growth','elevate your brand','free audit','60-second breakdown','guaranteed result'],
    excluded_domains:['yelp.com','angi.com','homeadvisor.com','bbb.org','facebook.com','instagram.com','linkedin.com','yellowpages.com','mapquest.com','thumbtack.com','houzz.com','nextdoor.com','chamberofcommerce.com','buildzoom.com','expertise.com'],
    excluded_brand_terms:['roto-rooter','one hour heating','onehourheatandair','benjamin franklin plumbing','mister sparky','service experts','ars rescue rooter','american residential services','home depot','lowes','lowe’s','sears home services']
  },
  integrations:{
    search_ready:true,search_mode:'PUBLIC_BING_HTML',history_ready:true,history_mode:'PROSPECT_MASTER_INDEX',
    delivery_ready:deliveryReady,missed_call_ready:missedCallReady,queue_ready:true,queue_mode:'PROSPECT_MASTER_APPEND',
    ollama_ready:false,ollama_base:'',ollama_model:''
  }
}}];
