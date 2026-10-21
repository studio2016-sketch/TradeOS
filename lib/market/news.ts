import type {NewsSignal} from "./types";


async function startNewsLedger(provider:string,endpoint:string,symbols:string[],limit:number){
  try{
    const {db}=await import("../db"); const sql=db();
    const rows=await sql`insert into tradeos_news_ingestion_runs(provider,endpoint,symbols,requested_limit,status)
      values(${provider},${endpoint},${JSON.stringify(symbols)}::jsonb,${limit},'started') returning id`;
    return rows[0]?.id?Number(rows[0].id):null;
  }catch{return null;}
}
async function finishNewsLedger(id:number|null,status:"finished"|"rate_limited"|"failed"|"skipped",received:number,httpStatus:number|null,details:Record<string,unknown>={}){
  if(id===null)return;
  try{
    const {db}=await import("../db"); const sql=db();
    await sql`update tradeos_news_ingestion_runs set completed_at=clock_timestamp(),status=${status},received=${received},http_status=${httpStatus},details=${JSON.stringify(details)}::jsonb where id=${id}`;
  }catch{}
}

async function cacheNews(provider:string,items:NewsSignal[]){
  if(!items.length)return;
  try{
    const {db}=await import("../db"); const sql=db();
    for(const item of items){
      const published=Date.parse(item.timestamp);
      if(!Number.isFinite(published))continue;
      await sql`insert into tradeos_news_articles(provider,article_id,published_at,headline,symbols,source_name,source_quality,summary)
        values(${provider},${item.id},${item.timestamp},${item.headline},${JSON.stringify(item.symbols)}::jsonb,${item.source},${item.sourceQuality},${item.summary??""})
        on conflict(provider,article_id) do update set
          published_at=excluded.published_at,ingested_at=clock_timestamp(),headline=excluded.headline,
          symbols=excluded.symbols,source_name=excluded.source_name,source_quality=excluded.source_quality,summary=excluded.summary`;
    }
  }catch{}
}
async function cachedNews(provider:string,symbols:string[],limit:number):Promise<NewsSignal[]>{
  try{
    const {db}=await import("../db"); const sql=db();
    const rows=await sql`select article_id,published_at,headline,symbols,source_name,source_quality,summary
      from tradeos_news_articles where provider=${provider} and published_at>=now()-interval '48 hours'
      order by published_at desc limit 150`;
    const clean=new Set(cleanSymbols(symbols));
    return rows.map(r=>({
      id:String(r.article_id),timestamp:new Date(r.published_at as string).toISOString(),headline:String(r.headline),
      symbols:Array.isArray(r.symbols)?r.symbols as string[]:[],source:String(r.source_name),sourceQuality:Number(r.source_quality),
      novelty:1,marketImpact:.5,priceConfirmed:false,summary:String(r.summary??"")
    } satisfies NewsSignal)).filter(item=>!clean.size||item.symbols.some(s=>clean.has(s))).slice(0,limit);
  }catch{return [];}
}
async function claimProviderSlot(provider:string,seconds:number):Promise<boolean>{
  const {db}=await import("../db"); const sql=db();
  const rows=await sql`insert into tradeos_provider_rate_limits(provider,endpoint,next_allowed_at,updated_at)
    values(${provider},'news',now()+(${seconds}*interval '1 second'),now())
    on conflict(provider,endpoint) do update
    set next_allowed_at=now()+(${seconds}*interval '1 second'),updated_at=now()
    where tradeos_provider_rate_limits.next_allowed_at<=now()
    returning provider`;
  return rows.length>0;
}

function cleanSymbols(symbols:string[]){
  return [...new Set(symbols.map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z0-9.-]{1,10}$/.test(s)))].slice(0,20);
}
function norm(s:string){return s.toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();}
function recencyScore(ts:string){
  const age=Math.max(0,Date.now()-new Date(ts).getTime());
  return Math.max(0,1-age/(24*60*60*1000));
}
function dedupe(items:NewsSignal[]){
  const seen=new Set<string>();
  return items.filter(x=>{
    const key=norm(x.headline).slice(0,140);
    if(!key||seen.has(key))return false;
    seen.add(key);return true;
  });
}

let alpacaNewsInFlight:Promise<NewsSignal[]>|null=null;
export async function alpacaNews(symbols:string[],limit=30):Promise<NewsSignal[]>{
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return[];
  const clean=cleanSymbols(symbols);
  if(alpacaNewsInFlight)return alpacaNewsInFlight;
  alpacaNewsInFlight=(async()=>{
  const url=new URL("https://data.alpaca.markets/v1beta1/news");
  if(clean.length)url.searchParams.set("symbols",clean.join(","));
  url.searchParams.set("limit",String(Math.min(50,limit)));
  url.searchParams.set("sort","desc");
  url.searchParams.set("include_content","false");
  const ledgerId=await startNewsLedger("alpaca","news",clean,Math.min(50,limit));
  try{
   if(!(await claimProviderSlot("alpaca",30))){
    const cached=await cachedNews("alpaca",clean,limit);
    await finishNewsLedger(ledgerId,"skipped",cached.length,null,{reason:"shared_rate_budget_exhausted",cacheHit:true});
    return cached;
   }
   const res=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store",signal:AbortSignal.timeout(12000)});
   if(res.status===429){
    await deferProviderSlot("alpaca",massiveRetryDelay(res.headers.get("retry-after")));
    const cached=await cachedNews("alpaca",clean,limit);
    await finishNewsLedger(ledgerId,"rate_limited",cached.length,429,{retryAfter:res.headers.get("retry-after"),cacheHit:cached.length>0});
    if(cached.length)return cached;
    throw new Error("Alpaca news HTTP 429; shared cooldown activated");
   }
   if(!res.ok){await finishNewsLedger(ledgerId,"failed",0,res.status);throw new Error(`Alpaca news HTTP ${res.status}`);}
   const data=await res.json() as any;
   const items=(data.news??[]).map((n:any)=>({
    id:`alpaca:${n.id}`,
    timestamp:String(n.updated_at??n.created_at??new Date().toISOString()),
    headline:String(n.headline??""),
    symbols:Array.isArray(n.symbols)?n.symbols:[],
    source:"Alpaca News",
    sourceQuality:.86,
    novelty:1,
    marketImpact:.5,
    priceConfirmed:false,
    summary:String(n.summary??"")
   }));
   await cacheNews("alpaca",items);
   await finishNewsLedger(ledgerId,"finished",items.length,res.status);
   return items;
  }catch(e){
   if(!(e instanceof Error&&e.message.startsWith("Alpaca news HTTP ")))await finishNewsLedger(ledgerId,"failed",0,null,{error:e instanceof Error?e.message:"unknown"});
   const cached=await cachedNews("alpaca",clean,limit);
   if(cached.length)return cached;
   throw e;
  }
  })();
  try{return await alpacaNewsInFlight;}finally{alpacaNewsInFlight=null;}
}

// Neon-backed atomic request reservation shared across serverless instances.
// This limits this endpoint; other Massive consumers must join the same budget
// before account-wide rate limits can be guaranteed.
let massiveNewsInFlight:Promise<NewsSignal[]>|null=null;
function massiveRetryDelay(value:string|null):number{
  if(!value)return 300_000;
  const seconds=Number(value);
  const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now();
  return Number.isFinite(delay)?Math.max(60_000,Math.min(3_600_000,delay)):300_000;
}
async function deferProviderSlot(provider:string,delayMs:number):Promise<void>{
  const {db}=await import("../db");
  const sql=db();
  const seconds=Math.ceil(delayMs/1000);
  await sql`update tradeos_provider_rate_limits
    set next_allowed_at=greatest(next_allowed_at,now()+(${seconds}*interval '1 second')),updated_at=now()
    where provider=${provider} and endpoint='news'`;
}
export async function massiveNews(symbols:string[],limit=30):Promise<NewsSignal[]>{
  const key=process.env.MASSIVE_API_KEY;
  if(!key)return [];
  if(massiveNewsInFlight)return massiveNewsInFlight;
  massiveNewsInFlight=(async()=>{
    // Fail closed if the shared budget cannot be checked; Alpaca remains available.
    const ledgerId=await startNewsLedger("massive","news",cleanSymbols(symbols),Math.min(20,limit));
    if(!(await claimProviderSlot("massive",60))){
      const cached=await cachedNews("massive",symbols,limit);
      await finishNewsLedger(ledgerId,"skipped",cached.length,null,{reason:"shared_rate_budget_exhausted",cacheHit:true});
      if(cached.length)return cached;
      throw new Error("Massive news unavailable: shared rate budget exhausted");
    }
    const url=new URL("https://api.massive.com/v2/reference/news");
    url.searchParams.set("order","desc");
    url.searchParams.set("sort","published_utc");
    url.searchParams.set("limit",String(Math.min(20,limit)));
    const res=await fetch(url,{headers:{"Authorization":`Bearer ${key}`},cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(res.status===429){
      await deferProviderSlot("massive",massiveRetryDelay(res.headers.get("retry-after")));
      const cached=await cachedNews("massive",symbols,limit);
      await finishNewsLedger(ledgerId,"rate_limited",cached.length,429,{retryAfter:res.headers.get("retry-after"),cacheHit:cached.length>0});
      if(cached.length)return cached;
      throw new Error("Massive news HTTP 429; shared cooldown activated");
    }
    if(!res.ok){await finishNewsLedger(ledgerId,"failed",0,res.status);throw new Error(`Massive news HTTP ${res.status}`);}
    const data=await res.json() as any;
    const items=(data.results??[]).map((n:any)=>({
      id:`massive:${n.id??n.article_url??n.published_utc}`,
      timestamp:String(n.published_utc??new Date().toISOString()),
      headline:String(n.title??""),
      symbols:Array.isArray(n.tickers)?n.tickers:[],
      source:`Massive / ${n.publisher?.name??"News"}`,
      sourceQuality:.78,novelty:1,marketImpact:.5,priceConfirmed:false,
      summary:String(n.description??"")
    } satisfies NewsSignal));
    await cacheNews("massive",items);
    await finishNewsLedger(ledgerId,"finished",items.length,res.status);
    return items;
  })();
  try{return await massiveNewsInFlight;}finally{massiveNewsInFlight=null;}
}

export async function curatedNews(symbols:string[],limit=40){
  const clean=cleanSymbols(symbols);
  const results=await Promise.allSettled([alpacaNews(clean,limit),massiveNews(clean,limit)]);
  const errors:string[]=[];
  const all:NewsSignal[]=[];
  results.forEach((r,i)=>{if(r.status==="fulfilled")all.push(...r.value);else errors.push(`${i===0?"Alpaca":"Massive"}: ${String(r.reason)}`);});
  const unique=dedupe(all);
  const ranked=unique.map(n=>{
    const overlap=n.symbols.filter(s=>clean.includes(s)).length;
    const relevance=clean.length?Math.min(1,overlap/Math.max(1,Math.min(2,clean.length))):.5;
    const recency=recencyScore(n.timestamp);
    const rank=.42*n.sourceQuality+.33*relevance+.25*recency;
    return {...n,relevance,recency,rank:+rank.toFixed(4)};
  }).sort((a,b)=>b.rank-a.rank).slice(0,limit);
  return{news:ranked,errors};
}
