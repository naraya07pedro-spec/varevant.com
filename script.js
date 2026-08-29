const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
document.getElementById('year').textContent=new Date().getFullYear();

const header=$('.site-header');
window.addEventListener('scroll',()=>header.classList.toggle('scrolled',scrollY>24),{passive:true});

const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});
$$('.reveal').forEach(el=>observer.observe(el));

const menu=$('.menu-toggle'), mobile=$('.mobile-menu');
menu?.addEventListener('click',()=>{const open=mobile.classList.toggle('open');menu.setAttribute('aria-expanded',open);mobile.setAttribute('aria-hidden',!open)});
$$('.mobile-menu a').forEach(a=>a.addEventListener('click',()=>mobile.classList.remove('open')));

const nodeData={
  Acquire:['Acquire','Every lead, form fill, or message finds its way in without someone manually copying it from one place to another.'],
  Understand:['Understand','Nothing gets flattened into a generic record — the details that make an opportunity or customer unique stick around.'],
  Qualify:['Qualify','The right rules and logic sort what matters before a person has to spend time looking at it.'],
  Convert:['Convert','Useful context lands in front of the right person at the right moment, so decisions happen faster.'],
  Evolve:['Evolve','Real usage and feedback keep shaping the system, instead of it staying frozen the way it launched.']
};
$$('.node').forEach(n=>n.addEventListener('click',()=>{ $$('.node').forEach(x=>x.classList.remove('active'));n.classList.add('active');const d=nodeData[n.dataset.node];$('#node-title').textContent=d[0];$('#node-copy').textContent=d[1]}));

const caps={
 revenue:{eyebrow:'LEAD & SALES AUTOMATION',title:"Every lead gets an instant reply, and nothing about them gets forgotten.",copy:"From the second someone messages you to the day they sign, we connect how leads come in, how they get sorted, and how your team follows up — so nothing sits in an inbox overnight and nobody has to type the same details twice.",items:['Instant Lead Capture From Every Channel','Automated Lead Qualification','Zero-Touch CRM & Database Syncing','Smart, Timely Follow-Ups — On Autopilot'],diagram:['ACQUIRE','QUALIFY','ROUTE','CONVERT']},
 platform:{eyebrow:'WEBSITES & CLIENT TOOLS',title:'A website that actually talks to the rest of your business.',copy:"We build websites and client portals that don't just sit there looking good — they're wired straight into your booking system, your CRM, and your day-to-day operations, so what a visitor sees on screen matches what's actually happening behind it.",items:['Websites Built to Convert Visitors Into Leads','Custom Client Portals & Dashboards','Direct Integration With Your Existing Tools','Built to Handle More Traffic and Data as You Grow'],diagram:['DESIGN','BUILD','CONNECT','LAUNCH']},
 intelligence:{eyebrow:'INTERNAL AI & KNOWLEDGE TOOLS',title:'Turn what your team already knows into an instant answer.',copy:"AI tools trained on your own documents, past conversations, and processes — so your team gets a straight answer in seconds instead of digging through folders or pinging around the office. Built around how your team actually works, not a generic chatbot bolted onto a wiki.",items:['Searchable Internal Knowledge Base','AI That Answers From Your Own Documents',"Built Around Your Team's Actual Workflow",'Private Access — Nothing Public'],diagram:['ASK','SEARCH','ANSWER','ACT']}
};
$$('.cap-tab').forEach(tab=>tab.addEventListener('click',()=>{const c=caps[tab.dataset.cap];$$('.cap-tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');$('#cap-copy').innerHTML=`<p class="eyebrow dark">${c.eyebrow}</p><h3>${c.title}</h3><p>${c.copy}</p><ul>${c.items.map(i=>`<li>${i}</li>`).join('')}</ul>`;$('#cap-diagram').innerHTML=c.diagram.map((x,i)=>`<span>${x}</span>${i<c.diagram.length-1?'<i></i>':''}`).join('')}));

const explore=$('.explore-work'), detail=$('#varevant-proof');
explore?.addEventListener('click',()=>{detail.classList.toggle('open');explore.querySelector('span').textContent=detail.classList.contains('open')?'↑':'↓';if(detail.classList.contains('open'))setTimeout(()=>detail.scrollIntoView({behavior:'smooth',block:'nearest'}),120)});

let scale=1,tx=0,ty=0,dragging=false,sx=0,sy=0;
const img=$('.zoomable'), viewport=$('.workflow-viewport');
function transform(){if(img)img.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`}
$('.zoom-in')?.addEventListener('click',()=>{scale=Math.min(2.6,scale+.2);transform()});
$('.zoom-out')?.addEventListener('click',()=>{scale=Math.max(1,scale-.2);if(scale===1){tx=0;ty=0}transform()});
viewport?.addEventListener('pointerdown',e=>{dragging=true;sx=e.clientX-tx;sy=e.clientY-ty;viewport.setPointerCapture(e.pointerId)});
viewport?.addEventListener('pointermove',e=>{if(!dragging)return;tx=e.clientX-sx;ty=e.clientY-sy;transform()});
viewport?.addEventListener('pointerup',()=>dragging=false);
viewport?.addEventListener('pointerleave',()=>dragging=false);

const tooltip=$('.hotspot-tooltip');
$$('.hotspot').forEach(h=>h.addEventListener('click',()=>{tooltip.textContent=h.dataset.hotspot;tooltip.classList.add('show');clearTimeout(window.hotspotTimer);window.hotspotTimer=setTimeout(()=>tooltip.classList.remove('show'),4200)}));

const form=$('#consult-form'), success=$('#form-success');
form?.addEventListener('submit',e=>{
 e.preventDefault();
 const fd=new FormData(form);
 const subject=encodeURIComponent(`Private Consultation — ${fd.get('company')||fd.get('name')}`);
 const body=encodeURIComponent(`Name: ${fd.get('name')}\nCompany: ${fd.get('company')}\nWork email: ${fd.get('email')}\nWebsite: ${fd.get('website')||'Not provided'}\n\nOperational context:\n${fd.get('context')}`);
 form.hidden=true;success.hidden=false;
 // Opens the user's mail client as a resilient static-site fallback.
 setTimeout(()=>window.location.href=`mailto:evan@varevant.com?subject=${subject}&body=${body}`,350);
});

document.addEventListener('mousemove',e=>{const g=$('.cursor-glow');if(g){g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'}},{passive:true});
