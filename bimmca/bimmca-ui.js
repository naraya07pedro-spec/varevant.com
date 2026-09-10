const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function go(id){$$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.section===id));$$('.section').forEach(s=>s.classList.toggle('active',s.id===id));window.scrollTo({top:0,behavior:'smooth'});}
$$('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.section));
$('#exportBtn').onclick=()=>window.print();
$('#drawerClose').onclick=()=>$('#drawer').classList.remove('open');
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#drawer').classList.remove('open')});

function rankClass(n){return n===1?'r1':n===2?'r2':n===3?'r3':''}
function rp(n){return `<span class="rankpill ${rankClass(n)}">#${n}</span>`}
function metricRank(key,brand){const arr=[...BRANDS].sort((a,b)=>key==='avg'?a[key]-b[key]:b[key]-a[key]);return arr.findIndex(x=>x.brand===brand)+1;}

function renderKpis(target,data){
  $(target).innerHTML=data.map((m,i)=>`<div class="box kpi"><label>${m[0]}</label><div class="value"><b>${m[1]}</b><span class="delta ${i===3?'down':''}">${m[2]}</span></div><small>${m[3]}</small></div>`).join('');
}

function renderOverviewTable(){
  $('#overviewTable').innerHTML=`<thead><tr><th>Brand</th><th>Overall</th><th>Authority</th><th>Mentions</th><th>SOV</th><th>Avg pos.</th><th>Top-1</th><th>Positive</th><th>30D</th></tr></thead><tbody>`+
  BRANDS.map(b=>`<tr data-brand="${b.brand}"><td><div class="brandcell"><i class="sw" style="background:${COLORS[b.brand]}"></i><strong>${b.brand}</strong></div></td><td>${rp(b.overall)}</td><td class="num">${b.visibility.toFixed(1)}</td><td class="num">${b.mentions}</td><td class="num">${b.sov.toFixed(1)}%</td><td class="num">${b.avg.toFixed(1)}</td><td class="num">${b.top1}%</td><td class="num">${b.sent}%</td><td class="${b.delta>=0?'pos':'neg'} num">${b.delta>=0?'+':''}${b.delta}</td></tr>`).join('')+`</tbody>`;
  bindBrandRows('#overviewTable');
}

function renderAuthority(){
  $('#trendLegend').innerHTML=Object.entries(COLORS).map(([n,c])=>`<span><i class="sw" style="background:${c}"></i>${n}</span>`).join('');
  $('#sovList').innerHTML=BRANDS.map(b=>`<div style="padding:8px 0;border-bottom:1px solid #e7eef3"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><b>${b.brand}</b><span class="num">${b.sov.toFixed(1)}%</span></div><div class="track"><i style="width:${b.sov}%;background:${COLORS[b.brand]}"></i></div></div>`).join('');
  $('#platformTable').innerHTML=`<thead><tr><th>Platform</th><th>NIVEA Authority</th><th>SOV</th><th>Avg pos.</th><th>Top-1</th><th>Positive</th></tr></thead><tbody>`+PLATFORM.map(r=>`<tr>${r.map((v,i)=>`<td class="${i?'num':''}">${v}</td>`).join('')}</tr>`).join('')+`</tbody>`;
}

function drawTrend(){
  const canvas=$('#trendChart'); if(!canvas)return;
  const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1; canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,rect.width,rect.height);
  const W=rect.width,H=rect.height,p={l:42,r:16,t:18,b:36},min=35,max=82;
  ctx.font='10px system-ui';ctx.fillStyle='#7590a0';ctx.strokeStyle='#e3edf2';ctx.lineWidth=1;
  [40,50,60,70,80].forEach(v=>{const y=p.t+(max-v)/(max-min)*(H-p.t-p.b);ctx.beginPath();ctx.moveTo(p.l,y);ctx.lineTo(W-p.r,y);ctx.stroke();ctx.fillText(v,p.l-26,y+3)});
  TREND.labels.forEach((lab,i)=>{const x=p.l+i*(W-p.l-p.r)/(TREND.labels.length-1);if(i%2===0||W>800)ctx.fillText(lab,x-16,H-12)});
  Object.entries(TREND.series).forEach(([name,arr])=>{ctx.beginPath();arr.forEach((v,i)=>{const x=p.l+i*(W-p.l-p.r)/(arr.length-1),y=p.t+(max-v)/(max-min)*(H-p.t-p.b);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=COLORS[name];ctx.lineWidth=name==='NIVEA'?3:2;ctx.stroke();});
}
window.addEventListener('resize',()=>requestAnimationFrame(drawTrend));

function renderCompetitors(){
  $('#competitorTable').innerHTML=`<thead><tr><th>Brand</th><th>Overall</th><th>Authority</th><th>SOV</th><th>Avg pos.</th><th>Top-1</th><th>Positive</th><th>Primary strength</th><th>Main weakness</th><th>NIVEA counter-move</th></tr></thead><tbody>`+
  BRANDS.map(b=>`<tr data-brand="${b.brand}"><td><div class="brandcell"><i class="sw" style="background:${COLORS[b.brand]}"></i><strong>${b.brand}</strong></div></td><td>${rp(b.overall)}</td><td>${rp(metricRank('visibility',b.brand))} <span class="num">${b.visibility.toFixed(1)}</span></td><td>${rp(metricRank('sov',b.brand))} <span class="num">${b.sov.toFixed(1)}%</span></td><td>${rp(metricRank('avg',b.brand))} <span class="num">${b.avg.toFixed(1)}</span></td><td>${rp(metricRank('top1',b.brand))} <span class="num">${b.top1}%</span></td><td>${rp(metricRank('sent',b.brand))} <span class="num">${b.sent}%</span></td><td>${b.strength}</td><td>${b.weakness}</td><td class="muted">${b.counter}</td></tr>`).join('')+`</tbody>`;
  bindBrandRows('#competitorTable');

  $('#competitorProfiles').innerHTML=BRANDS.map(b=>`<div class="topic"><div class="top"><div><b>${b.brand}</b><div class="muted" style="font-size:10px;margin-top:2px">Overall #${b.overall} · ${b.strength}</div></div>${rp(b.overall)}</div><p>${b.reason}</p><div class="callout"><b>Main vulnerability</b><br>${b.vulnerability}</div><div class="callout" style="margin-top:7px"><b>NIVEA response</b><br>${b.counter}</div><button class="btn" style="margin-top:9px" onclick="openBrand('${b.brand}')">View full intelligence</button></div>`).join('');
}

function openBrand(name){
  const b=BRANDS.find(x=>x.brand===name);
  $('#drawerTitle').textContent=name+' · competitive intelligence';
  $('#drawerBody').innerHTML=`
  <div class="drawer-section"><h4>Executive summary</h4><div class="drawer-card"><b>${name} ranks #${b.overall} overall</b><span>${b.reason}</span></div></div>
  <div class="drawer-section"><h4>Ranking breakdown</h4><div class="drawer-card"><b>Overall ${rp(b.overall)}</b><span>Authority #${metricRank('visibility',name)} · SOV #${metricRank('sov',name)} · Avg position #${metricRank('avg',name)} · Top-1 #${metricRank('top1',name)} · Sentiment #${metricRank('sent',name)}</span></div></div>
  <div class="drawer-section"><h4>Primary strength</h4><div class="drawer-card"><b>${b.strength}</b><span>${b.reason}</span></div></div>
  <div class="drawer-section"><h4>Main weakness</h4><div class="drawer-card"><b>${b.weakness}</b><span>Pilot-sample weakness, not a claim based on private AI conversations.</span></div></div>
  <div class="drawer-section"><h4>Where the brand is vulnerable</h4><div class="drawer-card"><b>${b.vulnerability}</b><span>This is where NIVEA or another competitor can attack authority more efficiently.</span></div></div>
  <div class="drawer-section"><h4>How NIVEA should respond</h4><div class="drawer-card"><b>Recommended counter-strategy</b><span>${b.counter}</span></div></div>
  <div class="drawer-section"><h4>Metrics</h4>${[['Authority',b.visibility],['Mentions',b.mentions],['Share of Voice',b.sov+'%'],['Avg position',b.avg],['Top-1',b.top1+'%'],['Positive sentiment',b.sent+'%']].map(x=>`<div class="drawer-card"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>`;
  $('#drawer').classList.add('open');
}

function bindBrandRows(sel){ $$(sel+' tbody tr').forEach(tr=>tr.onclick=()=>openBrand(tr.dataset.brand)); }

function renderGaps(query='',priority='All priorities'){
  const q=query.toLowerCase().trim();
  const rows=GAPS.filter(g=>(g.topic.toLowerCase().includes(q)||g.reason.toLowerCase().includes(q)||g.leader.toLowerCase().includes(q))&&(priority==='All priorities'||g.priority===priority));
  $('#gapCount').textContent=rows.length+' strategic gaps';
  $('#gapTable').innerHTML=`<thead><tr><th>Priority</th><th>Gap</th><th>Leader</th><th>NIVEA</th><th>Gap size</th><th>Why NIVEA loses</th><th>Recommended move</th><th>KPI target</th></tr></thead><tbody>`+
  rows.map(g=>`<tr><td><span class="status-pill ${g.priority==='Critical'?'planned':''}">${g.priority}</span></td><td><b>${g.topic}</b></td><td>${g.leader}</td><td class="num">${g.nivea}</td><td class="neg num">${g.gap} pts</td><td>${g.reason}</td><td>${g.action}</td><td class="num">${g.target}</td></tr>`).join('')+`</tbody>`;
}
$('#gapSearch').oninput=e=>renderGaps(e.target.value,$('#gapFilter').value);
$('#gapFilter').onchange=e=>renderGaps($('#gapSearch').value,e.target.value);

function renderStrategy(){
  $('#strategyRows').innerHTML=STRATEGY.map(s=>`<div class="strategy-row"><div class="priority">${s.p}</div><div><b>${s.problem}</b></div><div>${s.why}</div><div>${s.execution}</div><div class="num">${s.kpi}</div><div class="num">${s.window}</div></div>`).join('');
  $('#niveaRecommendation').innerHTML=[
    ['Lead with performance proof','Add efficacy and active-use evidence where Rexona currently dominates.'],
    ['Win head-to-head comparisons','Make NIVEA-vs-Rexona prompts easier for AI systems to answer with credible evidence.'],
    ['Expand external authority','Create more third-party editorial, review, community, and expert signals.'],
    ['Protect care equity','Do not trade away NIVEA’s strong comfort and skincare perception while chasing performance.']
  ].map(x=>`<div class="topic"><div class="top"><b>${x[0]}</b><span class="gap good">Do</span></div><p>${x[1]}</p></div>`).join('');
  $('#guardrails').innerHTML=[
    ['Do not chase prompt volume','Prioritize commercially meaningful intent, not every possible question.'],
    ['Do not publish generic AI content','Quality of evidence, distribution, and source authority matters more than volume.'],
    ['Do not overclaim realtime','Use scheduled live monitoring once n8n is connected; do not imply access to private AI conversations.'],
    ['Do not sell the dashboard','The paid value is strategy, execution, and measurable authority movement.']
  ].map(x=>`<div class="topic"><div class="top"><b>${x[0]}</b><span class="gap bad">Avoid</span></div><p>${x[1]}</p></div>`).join('');
}

function renderExecution(){
  $('#executionBoard').innerHTML=EXEC_PHASES.map(p=>`<div class="exec-card"><div style="display:flex;justify-content:space-between;gap:8px"><h4>${p.phase}</h4><span class="status-pill planned">${p.status}</span></div><p>${p.objective}</p><div class="exec-meta"><div><span>Window</span><b>${p.window}</b></div><div><span>Target</span><b>${p.target}</b></div><div style="grid-column:1/-1"><span>Proposed deliverables</span><b>${p.deliverables}</b></div></div></div>`).join('');
  $('#deliverableTable').innerHTML=`<thead><tr><th>Deliverable</th><th>Qty</th><th>Status</th><th>Strategic purpose</th></tr></thead><tbody>`+
  DELIVERABLES.map(r=>`<tr><td><b>${r[0]}</b></td><td class="num">${r[1]}</td><td><span class="status-pill planned">${r[2]}</span></td><td>${r[3]}</td></tr>`).join('')+`</tbody>`;
}

function renderCampaignKpis(){
  renderKpis('#campaignKpis',[
    ['Overall AI Rank','#1–#2','Target','Close gap to Rexona'],
    ['AI Share of Voice','40%+','+8 pts','Category-level authority share'],
    ['Top-3 Rate','70%+','+12 pts','Commercial-intent presence'],
    ['Performance Ownership','60%+','+22 pts','Sports / sweat cluster'],
    ['Citation Coverage','+30%','Target','More sourceable third-party proof'],
    ['Positive Sentiment','82%+','Protect','Keep care advantage']
  ]);
  $('#kpiTable').innerHTML=`<thead><tr><th>KPI</th><th>Baseline</th><th>90D target</th><th>Required movement</th><th>Window</th></tr></thead><tbody>`+
  KPI_TARGETS.map(r=>`<tr><td><b>${r[0]}</b></td><td class="num">${r[1]}</td><td class="num pos">${r[2]}</td><td>${r[3]}</td><td class="num">${r[4]}</td></tr>`).join('')+`</tbody>`;
}

function renderImpact(){
  $('#impactCards').innerHTML=IMPACT.map(i=>`<div class="impact-card"><span>${i.metric}</span><div class="compare"><div><span>Baseline</span><b>${i.baseline}</b></div><div><span>Target</span><b class="pos">${i.target}</b></div></div><p>${i.meaning}</p></div>`).join('');
  $('#impactMeaning').innerHTML=[
    ['Higher SOV','NIVEA appears more often relative to competitors in tracked commercial-intent answers.'],
    ['Higher topic ownership','AI systems have stronger reasons to associate NIVEA with performance use cases.'],
    ['Smaller Rexona gap','Competitive authority moves toward parity rather than simply generating more content.']
  ].map(x=>`<div class="topic"><div class="top"><b>${x[0]}</b><span class="gap good">Signal</span></div><p>${x[1]}</p></div>`).join('');
  $('#decisionRules').innerHTML=[
    ['If SOV rises but rank does not','Improve recommendation quality and comparison proof, not content volume.'],
    ['If citations rise but performance authority stays flat','Shift distribution toward sources and narratives tied directly to performance intent.'],
    ['If sentiment falls','Stop aggressive performance positioning and restore care-led balance.'],
    ['If Rexona gap closes rapidly','Scale the winning topic/source combinations before adding new initiatives.']
  ].map(x=>`<div class="topic"><div class="top"><b>${x[0]}</b><span class="gap good">Adapt</span></div><p>${x[1]}</p></div>`).join('');
}

function renderEvidence(){
  $('#promptTable').innerHTML=`<thead><tr><th>Prompt</th><th>Cluster</th><th>Platform</th><th>Leader</th><th>NIVEA</th><th>Interpretation</th></tr></thead><tbody>`+
  PROMPTS.map((p,i)=>`<tr data-prompt="${i}"><td><b>${p.prompt}</b></td><td>${p.cluster}</td><td>${p.platform}</td><td class="num">${p.leader}</td><td class="num">${p.nivea}</td><td>${p.note}</td></tr>`).join('')+`</tbody>`;
  $$('#promptTable tbody tr').forEach(tr=>tr.onclick=()=>openPrompt(+tr.dataset.prompt));
  $('#sourceList').innerHTML=SOURCES.map(s=>`<div class="source-row"><div><b>${s.name}</b><small>${s.type}</small></div><div>${s.brand}</div><div>${s.platform}</div><div class="num">${s.count} cites</div></div>`).join('');
}

function openPrompt(i){
  const p=PROMPTS[i];
  $('#drawerTitle').textContent='Evidence · prompt detail';
  $('#drawerBody').innerHTML=`<div class="drawer-section"><h4>Prompt</h4><div class="drawer-card"><b>${p.prompt}</b><span>${p.cluster} · ${p.platform}</span></div></div><div class="drawer-section"><h4>Outcome</h4><div class="drawer-card"><b>Leader: ${p.leader}</b><span>NIVEA position: ${p.nivea}</span></div></div><div class="drawer-section"><h4>Strategic interpretation</h4><div class="drawer-card"><b>What this means</b><span>${p.note}</span></div></div>`;
  $('#drawer').classList.add('open');
}

function init(){
  renderKpis('#executiveKpis',AUTH_METRICS);
  renderKpis('#authorityKpis',AUTH_METRICS);
  renderOverviewTable();
  renderAuthority();
  renderCompetitors();
  renderGaps();
  renderStrategy();
  renderExecution();
  renderCampaignKpis();
  renderImpact();
  renderEvidence();
  requestAnimationFrame(drawTrend);
}
init();

$('#globalSearch').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const q=e.target.value.trim().toLowerCase();
    if(!q)return;
    if(q.includes('rexona')||q.includes('dove')||q.includes('casablanca')||q.includes('compet'))go('competitors');
    else if(q.includes('strategy')||q.includes('action')||q.includes('recommend'))go('strategy');
    else if(q.includes('kpi')||q.includes('target'))go('kpis');
    else if(q.includes('source')||q.includes('prompt')||q.includes('evidence'))go('evidence');
    else if(q.includes('gap')||q.includes('sport')||q.includes('sweat'))go('gaps');
    else go('overview');
  }
});
