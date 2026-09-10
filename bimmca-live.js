// ---- Supabase live data adapter (safe fallback to pilot data) ----
async function initSupabaseLive(){
  const cfg=window.BIMMCA_SUPABASE||{};
  if(!cfg.url||!cfg.publishableKey||!window.supabase) return;
  try{
    const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false}});
    window.__bimmcaSupabase=client;

    const applyRows=(rows)=>{
      if(!Array.isArray(rows)||!rows.length) return;
      for(const row of rows){
        const b=BRANDS.find(x=>x.brand===row.brand);
        if(!b) continue;
        if(row.visibility_score!=null) b.visibility=Number(row.visibility_score);
        if(row.share_of_voice!=null) b.sov=Number(row.share_of_voice);
        if(row.avg_position!=null) b.avg=Number(row.avg_position);
        if(row.top1_rate!=null) b.top1=Number(row.top1_rate);
        if(row.positive_sentiment!=null) b.sent=Number(row.positive_sentiment);
        if(row.mentions!=null) b.mentions=Number(row.mentions);
      }
      [...BRANDS].sort((a,b)=>b.visibility-a.visibility).forEach((x,i)=>x.overall=i+1);
      renderOverviewTable();
      renderCompetitors();
      renderAuthority();
      renderKpis('#executiveKpis',[
        ['AI Authority Score',String((BRANDS.find(x=>x.brand==='NIVEA')?.visibility??72.4).toFixed(1)),'LIVE','Supabase latest metric'],
        ['Overall Rank','#'+(BRANDS.find(x=>x.brand==='NIVEA')?.overall??2),'LIVE','Current competitive position'],
        ['Share of Voice',(BRANDS.find(x=>x.brand==='NIVEA')?.sov??32).toFixed(1)+'%','LIVE','Share of category mentions'],
        ['Avg. Position',String((BRANDS.find(x=>x.brand==='NIVEA')?.avg??2.1).toFixed(1)),'LIVE','Lower is better'],
        ['Top-1 Rate',(BRANDS.find(x=>x.brand==='NIVEA')?.top1??26).toFixed(1)+'%','LIVE','First recommendation rate'],
        ['Positive Sentiment',(BRANDS.find(x=>x.brand==='NIVEA')?.sent??82).toFixed(1)+'%','LIVE','Current sentiment']
      ]);
      renderKpis('#authorityKpis',[
        ['AI Authority Score',String((BRANDS.find(x=>x.brand==='NIVEA')?.visibility??72.4).toFixed(1)),'LIVE','Supabase latest metric'],
        ['Overall Rank','#'+(BRANDS.find(x=>x.brand==='NIVEA')?.overall??2),'LIVE','Current competitive position'],
        ['Share of Voice',(BRANDS.find(x=>x.brand==='NIVEA')?.sov??32).toFixed(1)+'%','LIVE','Share of category mentions'],
        ['Avg. Position',String((BRANDS.find(x=>x.brand==='NIVEA')?.avg??2.1).toFixed(1)),'LIVE','Lower is better'],
        ['Top-1 Rate',(BRANDS.find(x=>x.brand==='NIVEA')?.top1??26).toFixed(1)+'%','LIVE','First recommendation rate'],
        ['Positive Sentiment',(BRANDS.find(x=>x.brand==='NIVEA')?.sent??82).toFixed(1)+'%','LIVE','Current sentiment']
      ]);
      const status=$('#dataStatusText'); if(status) status.textContent='LIVE · SUPABASE';
      const dot=$('#dataStatus .dot'); if(dot) dot.style.background='var(--green)';
    };

    const {data,error}=await client.from('brand_metrics_latest').select('*').eq('platform','gemini');
    if(error) throw error;
    applyRows(data);

    client.channel('bimmca-live-metrics')
      .on('postgres_changes',{event:'*',schema:'public',table:'brand_metrics_latest'},async()=>{
        const {data:latest,error:e}=await client.from('brand_metrics_latest').select('*').eq('platform','gemini');
        if(!e) applyRows(latest);
      })
      .subscribe();
  }catch(err){
    console.warn('Supabase live adapter unavailable; staying on pilot data.',err);
    const status=$('#dataStatusText'); if(status) status.textContent='PILOT DATASET';
  }
}

initSupabaseLive();
