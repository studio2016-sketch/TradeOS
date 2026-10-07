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
      timestamp:new Date(updated||Date.now()).toISOString(),
      price:Number(x.lastTrade?.p??x.min?.c??x.day?.c??0),
      volume:Number(x.day?.v??0),
      vwap:x.day?.vw==null?undefined:Number(x.day.vw),
      bid:x.lastQuote?.p==null?undefined:Number(x.lastQuote.p),
      ask:x.lastQuote?.P==null?undefined:Number(x.lastQuote.P),
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
    const ts=q?.t??b?.t??new Date().toISOString();
    const bid=q?.bp==null?undefined:Number(q.bp), ask=q?.ap==null?undefined:Number(q.ap);
    return {
      symbol,
      timestamp:String(ts),
      price:b?.c!=null?Number(b.c):(bid!=null&&ask!=null?(bid+ask)/2:0),
      volume:Number(b?.v??0),
      vwap:b?.vw==null?undefined:Number(b.vw),
      bid,ask,
      source:`Alpaca:${feed}`,
      coverage:feed==="sip"?"All US exchanges":feed==="iex"?"IEX only":feed==="delayed_sip"?"All US exchanges / delayed":"Provider-specific",
      entitlement:feed==="sip"?"full-market":feed==="iex"?"partial-real-time":"delayed-or-specialized"
    } satisfies MarketSnapshot;
  });
}

export async function bestSnapshots(symbols:string[]){
  const attempts:{source:string,error?:string,count?:number}[]=[];
  if(process.env.MASSIVE_API_KEY){
    try{const data=await massiveSnapshots(symbols); if(data.length)return {provider:"Massive",snapshots:data,attempts:[{source:"Massive",count:data.length}]};}
    catch(e){attempts.push({source:"Massive",error:e instanceof Error?e.message:String(e)});}
  }
  if(process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET){
    try{const data=await alpacaSnapshots(symbols); if(data.length)return {provider:"Alpaca",snapshots:data,attempts:[...attempts,{source:"Alpaca",count:data.length}]};}
    catch(e){attempts.push({source:"Alpaca",error:e instanceof Error?e.message:String(e)});}
  }
  return {provider:null,snapshots:[],attempts};
}
