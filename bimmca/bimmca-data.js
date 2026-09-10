const COLORS={NIVEA:'#0eb9d4',Rexona:'#4f8fff',Dove:'#20aa70',Casablanca:'#f47e2d'};

const BRANDS=[
 {brand:'Rexona',overall:1,visibility:76.1,mentions:963,sov:36.6,avg:1.7,top1:34,sent:77,delta:3.2,strength:'Performance / sweat protection',weakness:'Less gentle and less skincare-adjacent than NIVEA or Dove',reason:'Leads high-value sports, heavy-sweat, and long-lasting protection intent.',vulnerability:'Care-led, comfort-led, and soft-skin positioning.',counter:'NIVEA should add credible performance proof while preserving its care advantage.'},
 {brand:'NIVEA',overall:2,visibility:72.4,mentions:842,sov:32.0,avg:2.1,top1:26,sent:82,delta:4.8,strength:'Sensitive skin / daily comfort',weakness:'Under-indexed in heavy-sweat and hard-performance prompts',reason:'Strong all-round authority and positive sentiment, but weaker performance ownership keeps it behind Rexona.',vulnerability:'Sports and heavy-sweat prompts.',counter:'Build performance authority through proof, comparisons, citations, and third-party coverage.'},
 {brand:'Dove',overall:3,visibility:68.2,mentions:617,sov:24.2,avg:2.4,top1:19,sent:85,delta:2.1,strength:'Gentle formula / care narrative',weakness:'Lower visibility volume and weaker #1 ownership',reason:'Sentiment leader, but lower SOV and fewer first-position recommendations.',vulnerability:'Generic visibility and hard-performance proof.',counter:'NIVEA should defend care while maintaining broader visibility and stronger comparison ownership.'},
 {brand:'Casablanca',overall:4,visibility:42.4,mentions:196,sov:7.7,avg:3.8,top1:4,sent:61,delta:-0.4,strength:'Budget / value angle',weakness:'Weak visibility, trust, and topical ownership outside value prompts',reason:'Mostly appears when price is explicitly prioritized.',vulnerability:'Trust, premium perception, performance authority.',counter:'Low strategic priority unless NIVEA wants to compete on value language.'}
];

const AUTH_METRICS=[
 ['AI Authority Score','72.4','+4.8','Composite authority score'],
 ['Overall Rank','#2','—','Rexona is #1'],
 ['Share of Voice','32.0%','+2.3','Share of category mentions'],
 ['Avg. Position','2.1','-0.3','Lower is better'],
 ['Top-1 Rate','26%','+4.0','First recommendation rate'],
 ['Positive Sentiment','82%','+3.1','Care-led perception strength']
];

const TREND={labels:['Aug 11','Aug 15','Aug 19','Aug 23','Aug 27','Aug 31','Sep 04','Sep 08'],series:{NIVEA:[64,65,67,67,69,71,71.5,72.4],Rexona:[75,75.4,76,76.8,77.6,77.3,76.9,76.1],Dove:[66,66.1,66.9,66.2,67.4,67.8,67.9,68.2],Casablanca:[40,40.9,41,41.3,41.9,42.1,41.8,42.4]}};

const PLATFORM=[
 ['ChatGPT','73.1','31.7%','2.0','28%','81%'],
 ['Gemini','74.2','33.2%','1.9','30%','83%'],
 ['Perplexity','69.8','29.9%','2.4','21%','80%']
];

const GAPS=[
 {priority:'Critical',topic:'Sports / active women',gap:-41,leader:'Rexona',nivea:38,leaderScore:79,reason:'Rexona is more strongly associated with active use, sweat protection, and performance language.',action:'Performance Authority Sprint',kpi:'Topic ownership',target:'38 → 60'},
 {priority:'Critical',topic:'Heavy sweat protection',gap:-36,leader:'Rexona',nivea:43,leaderScore:79,reason:'NIVEA appears, but rarely as the strongest efficacy-led answer.',action:'Proof + comparison content',kpi:'Top-3 rate',target:'+8 pts'},
 {priority:'High',topic:'Long-lasting protection',gap:-23,leader:'Rexona',nivea:49,leaderScore:72,reason:'Rexona owns more “all-day” and hard-performance language.',action:'Sourceable efficacy evidence',kpi:'SOV',target:'+6 pts'},
 {priority:'High',topic:'Sensitive skin',gap:-4,leader:'Dove',nivea:82,leaderScore:86,reason:'NIVEA is very close, but Dove owns gentleness-first language.',action:'Defend care authority',kpi:'Sentiment',target:'82%+'},
 {priority:'Medium',topic:'Budget / value',gap:-17,leader:'Casablanca',nivea:44,leaderScore:61,reason:'Casablanca appears when low price becomes the primary decision criterion.',action:'De-prioritize unless needed',kpi:'Strategic fit',target:'Selective'}
];

const STRATEGY=[
 {p:'P1',problem:'Performance authority gap',why:'Largest gap and strongest reason Rexona ranks #1.',execution:'Active-women content cluster, expert-backed efficacy proof, structured FAQs, head-to-head comparisons.',kpi:'Topic ownership',window:'0–30D'},
 {p:'P2',problem:'Third-party authority deficit',why:'Brand-owned content alone is not enough to change AI recommendation confidence.',execution:'Editorial placements, community distribution, expert sources, reviews, and citation-oriented assets.',kpi:'Citation coverage',window:'15–60D'},
 {p:'P3',problem:'Comparison intent weakness',why:'NIVEA needs stronger direct evidence when users explicitly compare NIVEA vs Rexona.',execution:'Comparison pages, product evidence, claim substantiation, and sourceable structured answers.',kpi:'Top-1 rate',window:'30–75D'},
 {p:'P4',problem:'Protect care advantage',why:'Growth should not sacrifice NIVEA’s existing comfort and skincare positioning.',execution:'Ingredient education, comfort proof, sensitive-skin authority, and consistent care messaging.',kpi:'Positive sentiment',window:'Always'}
];

const EXEC_PHASES=[
 {phase:'Phase 1 · Diagnose & build',window:'Days 1–30',status:'Planned',objective:'Close the performance evidence gap',deliverables:'Authority content, FAQs, comparisons, expert proof',target:'Rexona'},
 {phase:'Phase 2 · Distribute authority',window:'Days 31–60',status:'Planned',objective:'Increase credible third-party presence',deliverables:'Editorial, community, review, citation coverage',target:'Rexona + Dove'},
 {phase:'Phase 3 · Scale what moves',window:'Days 61–90',status:'Planned',objective:'Convert movement into category leadership',deliverables:'Refresh winners, scale sources, suppress weak themes',target:'Rexona'}
];

const DELIVERABLES=[
 ['Authority articles','12','Planned','Performance + comparison intent'],
 ['Structured Q&A assets','20','Planned','AI-retrievable answer coverage'],
 ['Expert / proof pages','5','Planned','Efficacy and source credibility'],
 ['Third-party editorial placements','8','Planned','External authority'],
 ['Community placements','20','Planned','Lifestyle / discussion footprint'],
 ['Comparison assets','6','Planned','NIVEA vs category leaders'],
 ['Monthly strategic review','3','Planned','Measure → adapt → execute']
];

const KPI_TARGETS=[
 ['Overall AI Rank','#2','#1–#2','Close gap to Rexona','90D'],
 ['AI Share of Voice','32.0%','40%+','+8 pts','90D'],
 ['Top-3 Recommendation Rate','58%','70%+','+12 pts','90D'],
 ['Performance Topic Ownership','38%','60%+','+22 pts','90D'],
 ['Citation Coverage','Baseline','+30%','Increase source authority','90D'],
 ['Positive Sentiment','82%','82%+','Protect current strength','90D']
];

const IMPACT=[
 {metric:'AI Share of Voice',baseline:'32.0%',target:'40%+',meaning:'More category-level recommendation presence.'},
 {metric:'Performance Ownership',baseline:'38%',target:'60%+',meaning:'NIVEA becomes materially more credible in active / sweat-led intent.'},
 {metric:'Top-3 Rate',baseline:'58%',target:'70%+',meaning:'NIVEA appears more consistently in the consideration set.'},
 {metric:'Rank Gap to Rexona',baseline:'4.6 pts',target:'≤2 pts',meaning:'Competitive authority gap materially narrows.'},
 {metric:'Citation Coverage',baseline:'Current',target:'+30%',meaning:'More sourceable third-party evidence exists for AI retrieval.'},
 {metric:'Positive Sentiment',baseline:'82%',target:'82%+',meaning:'Performance growth does not weaken care-led perception.'}
];

const PROMPTS=[
 {prompt:'Deodorant wanita terbaik untuk aktivitas seharian',cluster:'Generic',platform:'Gemini',leader:'Rexona',nivea:'#2',note:'NIVEA remains visible but Rexona wins on stronger protection language.'},
 {prompt:'Deodorant wanita untuk kulit sensitif',cluster:'Care',platform:'ChatGPT',leader:'Dove',nivea:'#2',note:'NIVEA is close, but Dove still owns gentleness-first language.'},
 {prompt:'NIVEA vs Rexona untuk olahraga',cluster:'Comparison',platform:'Perplexity',leader:'Rexona',nivea:'#2',note:'Largest strategic gap: performance authority.'},
 {prompt:'Deodorant yang tidak meninggalkan noda di baju',cluster:'Daily use',platform:'ChatGPT',leader:'NIVEA',nivea:'#1',note:'Defensible NIVEA win area.'},
 {prompt:'Deodorant terbaik untuk keringat berlebih',cluster:'Performance',platform:'Gemini',leader:'Rexona',nivea:'#3',note:'NIVEA is present but not strong enough to challenge the leader.'},
 {prompt:'Deodorant wanita paling wangi dan nyaman',cluster:'Care',platform:'ChatGPT',leader:'NIVEA',nivea:'#1',note:'NIVEA benefits from softer-care associations.'}
];

const SOURCES=[
 {name:'nivea.co.id',type:'Brand site',platform:'Gemini',count:18,brand:'NIVEA'},
 {name:'rexona.com',type:'Brand site',platform:'Gemini',count:17,brand:'Rexona'},
 {name:'femaledaily.com',type:'Review / editorial',platform:'Perplexity',count:11,brand:'NIVEA'},
 {name:'sociolla.com',type:'Retail / editorial',platform:'ChatGPT',count:9,brand:'Dove'},
 {name:'alodokter.com',type:'Health editorial',platform:'Perplexity',count:7,brand:'Mixed'},
 {name:'hellosehat.com',type:'Health editorial',platform:'ChatGPT',count:6,brand:'Mixed'}
];
