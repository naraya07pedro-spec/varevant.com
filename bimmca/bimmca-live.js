// ---- Supabase live data adapter (safe fallback to pilot data) ----
async function initSupabaseLive(){
  const cfg=window.BIMMCA_SUPABASE||{};
  if(!cfg.url||!cfg.publishableKey||!window.supabase) return;

  const setStatus=(text,ok=true)=>{
    const status=$('#dataStatusText'); if(status) status.textContent=text;
    const dot=$('#dataStatus .dot'); if(dot) dot.style.background=ok?'var(--green)':'#f59e0b';
  };

  const updateExecutiveCopy=()=>{
    const ranked=[...BRANDS].sort((a,b)=>b.visibility-a.visibility);
    const nivea=BRANDS.find(x=>x.brand==='NIVEA');
    const leader=ranked[0];
    if(!nivea||!leader) return;

    const h=$('#overview .page-head h1');
    if(h) h.textContent=nivea.overall===1
      ? `NIVEA is #1 in the latest Gemini sample.`
      : `NIVEA is #${nivea.overall}. ${leader.brand} leads the latest Gemini sample.`;

    const scope=$$('#overview .scopebar span');
    if(scope[0]) scope[0].innerHTML=`<b>Current rank:</b> #${nivea.overall}`;
    if(scope[1]) scope[1].innerHTML=`<b>Primary threat:</b> ${nivea.overall===1?(ranked[1]?.brand||'—'):leader.brand}`;
  };

  try{
    const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false}});
    window.__bimmcaSupabase=client;

    const applyRows=(rows)=>{
      if(!Array.isArray(rows)||!rows.length) return;
      let newest=null;

      for(const row of rows){
        const b=BRANDS.find(x=>x.brand===row.brand);
        if(!b) continue;
        if(row.visibility_score!=null) b.visibility=Number(row.visibility_score);
        if(row.share_of_voice!=null) b.sov=Number(row.share_of_voice);
        if(row.avg_position!=null) b.avg=Number(row.avg_position);
        if(row.top1_rate!=null) b.top1=Number(row.top1_rate);
        if(row.top3_rate!=null) b.top3=Number(row.top3_rate);
        if(row.positive_sentiment!=null) b.sent=Number(row.positive_sentiment);
        if(row.mention_rate!=null) b.mentionRate=Number(row.mention_rate);
        if(row.recommendation_rate!=null) b.recommendationRate=Number(row.recommendation_rate);
        if(row.updated_at){
          const t=new Date(row.updated_at);
          if(!newest||t>newest) newest=t;
        }
      }

      [...BRANDS].sort((a,b)=>b.visibility-a.visibility).forEach((x,i)=>x.overall=i+1);
      renderOverviewTable();
      renderCompetitors();
      renderAuthority();
      updateExecutiveCopy();

      const n=BRANDS.find(x=>x.brand==='NIVEA');
      const kpis=[
        ['AI Authority Score',String((n?.visibility??0).toFixed(1)),'LIVE','Latest Gemini authority metric'],
        ['Overall Rank','#'+(n?.overall??'—'),'LIVE','Ranked by current authority score'],
        ['Share of Voice',(n?.sov??0).toFixed(1)+'%','LIVE','Share of tracked brand presence'],
        ['Avg. Position',String((n?.avg??0).toFixed(2)),'LIVE','Lower is better'],
        ['Top-1 Rate',(n?.top1??0).toFixed(1)+'%','LIVE','First recommendation rate'],
        ['Positive Sentiment',(n?.sent??0).toFixed(1)+'%','LIVE','Current extracted sentiment']
      ];
      renderKpis('#executiveKpis',kpis);
      renderKpis('#authorityKpis',kpis);

      const freshness=newest
        ? newest.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
        : 'latest run';
      setStatus(`LIVE · GEMINI · ${freshness}`,true);
    };

    const refresh=async()=>{
      const {data,error}=await client
        .from('brand_metrics_latest')
        .select('*')
        .eq('platform','gemini');
      if(error) throw error;
      applyRows(data);
    };

    await refresh();

    client.channel('bimmca-live-metrics')
      .on('postgres_changes',{event:'*',schema:'public',table:'brand_metrics_latest'},async()=>{
        try{ await refresh(); }catch(e){ console.warn('Realtime refresh failed',e); }
      })
      .subscribe((status)=>{
        if(status==='SUBSCRIBED') setStatus($('#dataStatusText')?.textContent||'LIVE · GEMINI',true);
      });
  }catch(err){
    console.warn('Supabase live adapter unavailable; staying on pilot data.',err);
    setStatus('PILOT DATASET · LIVE CONNECTION UNAVAILABLE',false);
  }
}

initSupabaseLive();
