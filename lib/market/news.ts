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

// Best-effort in-process throttle. Serverless instances do not share this state;
// a distributed provider budget is still needed for fleet-wide enforcement.
let massiveNewsNextAllowedAt=0;
let massiveNewsInFlight:Promise<NewsSignal[]>|null=null;
function massiveRetryDelay(value:string|null):number{
  if(!value)return 5*60_000;
  const seconds=Number(value);
  const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now();
  return Number.isFinite(delay)?Math.max(60_000,Math.min(60*60_000,delay)):5*60_000;
}
export async function massiveNews(symbols:string[],limit=30):Promise<NewsSignal[]>{
  const key=process.env.MASSIVE_API_KEY;
  if(!key)return [];
  if(Date.now()<massiveNewsNextAllowedAt)throw new Error("Massive news unavailable: rate-limit cooldown active");
  if(massiveNewsInFlight)return massiveNewsInFlight;
  massiveNewsInFlight=(async()=>{
    const url=new URL("https://api.massive.com/v2/reference/news");
    url.searchParams.set("order","desc");
    url.searchParams.set("sort","published_utc");
    url.searchParams.set("limit",String(Math.min(20,limit)));
    // Keep credentials out of URLs and associated request logs.
    const res=await fetch(url,{headers:{"Authorization":`Bearer ${key}`},cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(res.status===429){
      massiveNewsNextAllowedAt=Date.now()+massiveRetryDelay(res.headers.get("retry-after"));
      throw new Error("Massive news HTTP 429; cooldown activated");
    }
    if(!res.ok)throw new Error(`Massive news HTTP ${res.status}`);
    const data=await res.json() as any;
    // Minimum spacing between requests from this process.
    massiveNewsNextAllowedAt=Date.now()+60_000;
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
