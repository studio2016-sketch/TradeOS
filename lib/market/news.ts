import type {NewsSignal} from "./types";

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

export async function alpacaNews(symbols:string[],limit=30):Promise<NewsSignal[]>{
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return[];
  const clean=cleanSymbols(symbols);
  const url=new URL("https://data.alpaca.markets/v1beta1/news");
  if(clean.length)url.searchParams.set("symbols",clean.join(","));
  url.searchParams.set("limit",String(Math.min(50,limit)));
  url.searchParams.set("sort","desc");
  url.searchParams.set("include_content","false");
  const res=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store"});
  if(!res.ok)throw new Error(`Alpaca news HTTP ${res.status}`);
  const data=await res.json() as any;
  return (data.news??[]).map((n:any)=>({
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
async function claimMassiveSlot():Promise<boolean>{
  const {db}=await import("../db");
  const sql=db();
  const rows=await sql`INSERT INTO tradeos_provider_rate_limits(provider,endpoint,next_allowed_at,updated_at)
    VALUES('massive','news',now()+interval '60 seconds',now())
    ON CONFLICT(provider,endpoint) DO UPDATE
    SET next_allowed_at=now()+interval '60 seconds',updated_at=now()
    WHERE tradeos_provider_rate_limits.next_allowed_at<=now()
    RETURNING provider`;
  return rows.length>0;
}
async function deferMassiveSlot(delayMs:number):Promise<void>{
  const {db}=await import("../db");
  const sql=db();
  const seconds=Math.ceil(delayMs/1000);
  await sql`UPDATE tradeos_provider_rate_limits
    SET next_allowed_at=GREATEST(next_allowed_at,now()+(${seconds}*interval '1 second')),updated_at=now()
    WHERE provider='massive' AND endpoint='news'`;
}
export async function massiveNews(symbols:string[],limit=30):Promise<NewsSignal[]>{
  const key=process.env.MASSIVE_API_KEY;
  if(!key)return [];
  if(massiveNewsInFlight)return massiveNewsInFlight;
  massiveNewsInFlight=(async()=>{
    // Fail closed if the shared budget cannot be checked; Alpaca remains available.
    if(!(await claimMassiveSlot()))throw new Error("Massive news unavailable: shared rate budget exhausted");
    const url=new URL("https://api.massive.com/v2/reference/news");
    url.searchParams.set("order","desc");
    url.searchParams.set("sort","published_utc");
    url.searchParams.set("limit",String(Math.min(20,limit)));
    const res=await fetch(url,{headers:{"Authorization":`Bearer ${key}`},cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(res.status===429){
      await deferMassiveSlot(massiveRetryDelay(res.headers.get("retry-after")));
      throw new Error("Massive news HTTP 429; shared cooldown activated");
    }
    if(!res.ok)throw new Error(`Massive news HTTP ${res.status}`);
    const data=await res.json() as any;
    return (data.results??[]).map((n:any)=>({
      id:`massive:${n.id??n.article_url??n.published_utc}`,
      timestamp:String(n.published_utc??new Date().toISOString()),
      headline:String(n.title??""),
      symbols:Array.isArray(n.tickers)?n.tickers:[],
      source:`Massive / ${n.publisher?.name??"News"}`,
      sourceQuality:.78,novelty:1,marketImpact:.5,priceConfirmed:false,
      summary:String(n.description??"")
    } satisfies NewsSignal));
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
