import type {MarketSnapshot} from "./types";

function cleanSymbols(symbols:string[]){
  return [...new Set(symbols.map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z0-9.-]{1,10}$/.test(s)))].slice(0,50);
}
function nsToMs(v:number){
  if(v>1e17) return Math.floor(v/1e6);
  if(v>1e14) return Math.floor(v/1e3);
  return v;
}
export async function massiveSnapshots(symbols:string[]):Promise<MarketSnapshot[]>{
  const key=process.env.MASSIVE_API_KEY;
  if(!key) return [];
  const clean=cleanSymbols(symbols);
  if(!clean.length) return [];
  const url=new URL("https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers");
  url.searchParams.set("tickers",clean.join(","));
  url.searchParams.set("apiKey",key);
  const res=await fetch(url,{cache:"no-store"});
  if(!res.ok) throw new Error(`Massive snapshot HTTP ${res.status}`);
  const data=await res.json() as any;
  return (data.tickers??[]).map((x:any)=>{
    const updated=nsToMs(Number(x.updated??0));
    return {
      symbol:String(x.ticker),
      timestamp:updated>0?new Date(updated).toISOString():"",
      price:Number(x.lastTrade?.p??x.min?.c??x.day?.c??0),
      volume:Number(x.day?.v??0),
      vwap:x.day?.vw==null?undefined:Number(x.day.vw),
      bid:x.lastQuote?.p==null?undefined:Number(x.lastQuote.p),
      ask:x.lastQuote?.P==null?undefined:Number(x.lastQuote.P),
      bidSize:x.lastQuote?.s==null?undefined:Number(x.lastQuote.s),
      askSize:x.lastQuote?.S==null?undefined:Number(x.lastQuote.S),
      source:"Massive",
      coverage:"US consolidated snapshot",
      entitlement:"Determined by Massive subscription"
    } satisfies MarketSnapshot;
  });
}

export async function alpacaSnapshots(symbols:string[]):Promise<MarketSnapshot[]>{
  const key=process.env.ALPACA_API_KEY;
  const secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret) return [];
  const clean=cleanSymbols(symbols);
  if(!clean.length) return [];
  const feed=process.env.ALPACA_FEED||"iex";
  const headers={"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret};
  const [quotesRes,barsRes]=await Promise.all([
    fetch(`https://data.alpaca.markets/v2/stocks/quotes/latest?symbols=${encodeURIComponent(clean.join(","))}&feed=${encodeURIComponent(feed)}`,{headers,cache:"no-store"}),
    fetch(`https://data.alpaca.markets/v2/stocks/bars/latest?symbols=${encodeURIComponent(clean.join(","))}&feed=${encodeURIComponent(feed)}`,{headers,cache:"no-store"})
  ]);
  if(!quotesRes.ok||!barsRes.ok) throw new Error(`Alpaca market data HTTP ${quotesRes.status}/${barsRes.status}`);
  const quotes=(await quotesRes.json() as any).quotes??{};
  const bars=(await barsRes.json() as any).bars??{};
  return clean.map(symbol=>{
    const q=quotes[symbol], b=bars[symbol];
    const ts=q?.t??b?.t??"";
    const bid=q?.bp==null?undefined:Number(q.bp), ask=q?.ap==null?undefined:Number(q.ap), bidSize=q?.bs==null?undefined:Number(q.bs), askSize=q?.as==null?undefined:Number(q.as);
    return {
      symbol,
      timestamp:String(ts),
      price:b?.c!=null?Number(b.c):(bid!=null&&ask!=null?(bid+ask)/2:0),
      volume:Number(b?.v??0),
      vwap:b?.vw==null?undefined:Number(b.vw),
      bid,ask,bidSize,askSize,
      source:`Alpaca:${feed}`,
      coverage:feed==="sip"?"All US exchanges":feed==="iex"?"IEX only":feed==="delayed_sip"?"All US exchanges / delayed":"Provider-specific",
      entitlement:feed==="sip"?"full-market":feed==="iex"?"partial-real-time":"delayed-or-specialized"
    } satisfies MarketSnapshot;
  });
}

/**
 * Prefer the freshest valid provider observation per symbol rather than stopping
 * at the first successful (possibly stale) snapshot response.
 * A valid observation is not a certified real-time feed.
 */
export async function bestSnapshots(symbols:string[]){
  const clean=cleanSymbols(symbols);
  const attempts:{source:string,error?:string,count?:number}[]=[];
  const responses=await Promise.all([
    process.env.MASSIVE_API_KEY
      ? massiveSnapshots(clean).then(data=>({name:"Massive",data,error:""})).catch((e:unknown)=>({name:"Massive",data:[] as MarketSnapshot[],error:e instanceof Error?e.message:String(e)}))
      : Promise.resolve({name:"Massive",data:[] as MarketSnapshot[],error:"unconfigured"}),
    process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET
      ? alpacaSnapshots(clean).then(data=>({name:"Alpaca",data,error:""})).catch((e:unknown)=>({name:"Alpaca",data:[] as MarketSnapshot[],error:e instanceof Error?e.message:String(e)}))
      : Promise.resolve({name:"Alpaca",data:[] as MarketSnapshot[],error:"unconfigured"})
  ]);
  const picks=new Map<string,MarketSnapshot>();
  for(const response of responses){
    attempts.push({source:response.name,...(response.error?{error:response.error}:{}),count:response.data.length});
    for(const snapshot of response.data){
      if(!clean.includes(snapshot.symbol)||!Number.isFinite(snapshot.price)||snapshot.price<=0)continue;
      const stamp=Date.parse(snapshot.timestamp);
      if(!Number.isFinite(stamp)||stamp<=0||stamp>Date.now()+60_000)continue;
      const prev=picks.get(snapshot.symbol);
      const prevTime=prev?Date.parse(prev.timestamp):0;
      if(!prev||stamp>prevTime)picks.set(snapshot.symbol,snapshot);
    }
  }
  const snapshots=clean.map(s=>picks.get(s)).filter((s):s is MarketSnapshot=>Boolean(s));
  const providers=[...new Set(snapshots.map(s=>s.source.split(":")[0]))];
  return {provider:providers.length===0?null:providers.length===1?providers[0]:"Mixed",snapshots,attempts};
}
