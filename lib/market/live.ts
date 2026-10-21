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
    const tradeTime=nsToMs(Number(x.lastTrade?.t??0));
    const minuteTime=nsToMs(Number(x.min?.t??0));
    const dayTime=nsToMs(Number(x.day?.t??0));
    const tradePrice=Number(x.lastTrade?.p),minutePrice=Number(x.min?.c),dayPrice=Number(x.day?.c);
    const tradeValid=tradeTime>0&&Number.isFinite(tradePrice)&&tradePrice>0;
    const minuteValid=minuteTime>0&&Number.isFinite(minutePrice)&&minutePrice>0;
    const dayValid=dayTime>0&&Number.isFinite(dayPrice)&&dayPrice>0;
    const priceTime=tradeValid?tradeTime:minuteValid?minuteTime:dayValid?dayTime:0;
    const observedPrice=tradeValid?tradePrice:minuteValid?minutePrice:dayValid?dayPrice:0;
    return {
      symbol:String(x.ticker),
      timestamp:priceTime>0?new Date(priceTime).toISOString():"",
      price:observedPrice,
      quoteTimestamp:x.lastQuote?.t?new Date(nsToMs(Number(x.lastQuote.t))).toISOString():undefined,
      priceKind:tradeValid?"last_trade":minuteValid?"minute_close":"day_close",
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

async function alpacaSnapshotsForFeed(symbols:string[],feed:string):Promise<MarketSnapshot[]>{
  const key=process.env.ALPACA_API_KEY;
  const secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret) return [];
  const clean=cleanSymbols(symbols);
  if(!clean.length) return [];
  const headers={"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret};
  const url=new URL("https://data.alpaca.markets/v2/stocks/snapshots");
  url.searchParams.set("symbols",clean.join(","));
  url.searchParams.set("feed",feed);
  const res=await fetch(url,{headers,cache:"no-store"});
  if(!res.ok){
    const reset=res.headers.get("x-ratelimit-reset");
    const remaining=res.headers.get("x-ratelimit-remaining");
    throw new Error("Alpaca "+feed+" snapshots HTTP "+res.status+(remaining!=null?" remaining="+remaining:"")+(reset?" reset="+reset:""));
  }
  const data=await res.json() as any;
  return clean.map(symbol=>{
    const snap=data?.[symbol]??{};
    const q=snap.latestQuote;
    const trade=snap.latestTrade;
    const minute=snap.minuteBar;
    const daily=snap.dailyBar;
    const tradePrice=Number(trade?.p);
    const minutePrice=Number(minute?.c);
    const dailyPrice=Number(daily?.c);
    const tradeValid=trade?.t&&Number.isFinite(tradePrice)&&tradePrice>0;
    const minuteValid=minute?.t&&Number.isFinite(minutePrice)&&minutePrice>0;
    const dailyValid=daily?.t&&Number.isFinite(dailyPrice)&&dailyPrice>0;
    const price=tradeValid?tradePrice:minuteValid?minutePrice:dailyValid?dailyPrice:0;
    const ts=tradeValid?String(trade.t):minuteValid?String(minute.t):dailyValid?String(daily.t):"";
    const bid=q?.bp==null?undefined:Number(q.bp),ask=q?.ap==null?undefined:Number(q.ap),bidSize=q?.bs==null?undefined:Number(q.bs),askSize=q?.as==null?undefined:Number(q.as);
    return {
      symbol,
      timestamp:ts,
      price,
      priceKind:tradeValid?"last_trade":minuteValid?"minute_close":"day_close",
      quoteTimestamp:q?.t?String(q.t):undefined,
      volume:Number(daily?.v??minute?.v??0),
      vwap:minute?.vw==null?(daily?.vw==null?undefined:Number(daily.vw)):Number(minute.vw),
      bid,ask,bidSize,askSize,
      source:"Alpaca:"+feed,
      coverage:feed==="sip"?"All US exchanges":feed==="iex"?"IEX only":feed==="delayed_sip"?"All US exchanges / delayed":"Provider-specific",
      entitlement:feed==="sip"?"full-market":feed==="iex"?"partial-real-time":"delayed-or-specialized"
    } satisfies MarketSnapshot;
  });
}

export async function alpacaSnapshots(symbols:string[]):Promise<MarketSnapshot[]>{
  return alpacaSnapshotsForFeed(symbols,process.env.ALPACA_FEED||"iex");
}

export async function alpacaDelayedSipSnapshots(symbols:string[]):Promise<MarketSnapshot[]>{
  return alpacaSnapshotsForFeed(symbols,"delayed_sip");
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
    process.env.MASSIVE_API_KEY&&process.env.MASSIVE_STOCK_SNAPSHOT_ENABLED==="true"
      ? massiveSnapshots(clean).then(data=>({name:"Massive",data,error:""})).catch((e:unknown)=>({name:"Massive",data:[] as MarketSnapshot[],error:e instanceof Error?e.message:String(e)}))
      : Promise.resolve({name:"Massive",data:[] as MarketSnapshot[],error:process.env.MASSIVE_API_KEY?"disabled_by_entitlement_policy":"unconfigured"}),
    process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET
      ? alpacaSnapshots(clean).then(data=>({name:"Alpaca",data,error:""})).catch((e:unknown)=>({name:"Alpaca",data:[] as MarketSnapshot[],error:e instanceof Error?e.message:String(e)}))
      : Promise.resolve({name:"Alpaca",data:[] as MarketSnapshot[],error:"unconfigured"})
  ]);
  const picks=new Map<string,MarketSnapshot>();
  const apply=(name:string,data:MarketSnapshot[],error="")=>{
    attempts.push({source:name,...(error?{error}:{}),count:data.length});
    for(const snapshot of data){
      if(!clean.includes(snapshot.symbol)||!Number.isFinite(snapshot.price)||snapshot.price<=0)continue;
      const stamp=Date.parse(snapshot.timestamp);
      if(!Number.isFinite(stamp)||stamp<=0||stamp>Date.now()+60_000)continue;
      const prev=picks.get(snapshot.symbol),prevTime=prev?Date.parse(prev.timestamp):0;
      if(!prev||stamp>prevTime)picks.set(snapshot.symbol,snapshot);
    }
  };
  for(const response of responses)apply(response.name,response.data,response.error);
  const fallbackSymbols=clean.filter(symbol=>{
    const pick=picks.get(symbol),stamp=pick?Date.parse(pick.timestamp):NaN;
    return !Number.isFinite(stamp)||Date.now()-stamp>10*60*1000;
  });
  if(fallbackSymbols.length&&process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET&&process.env.ALPACA_DELAYED_SIP_FALLBACK!=="false"){
    try{apply("Alpaca delayed_sip",await alpacaDelayedSipSnapshots(fallbackSymbols));}
    catch(e){apply("Alpaca delayed_sip",[],e instanceof Error?e.message:String(e));}
  }
  const snapshots=clean.map(s=>picks.get(s)).filter((s):s is MarketSnapshot=>Boolean(s));
  const providers=[...new Set(snapshots.map(s=>s.source.split(":")[0]))];
  return {provider:providers.length===0?null:providers.length===1?providers[0]:"Mixed",snapshots,attempts};
}

export async function alpacaMarketClock(){
  const key=process.env.ALPACA_API_KEY;
  const secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return null;
  const env=process.env.ALPACA_TRADING_ENV==="live"?"live":"paper";
  const base=env==="live"?"https://api.alpaca.markets":"https://paper-api.alpaca.markets";
  const res=await fetch(base+"/v2/clock",{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret,"Accept":"application/json"},cache:"no-store"});
  if(!res.ok)throw new Error(`Alpaca clock HTTP ${res.status}`);
  const j=await res.json() as any;
  return{
    source:"Alpaca Market Clock",
    environment:env,
    timestamp:String(j.timestamp??new Date().toISOString()),
    isOpen:Boolean(j.is_open),
    nextOpen:String(j.next_open??""),
    nextClose:String(j.next_close??"")
  };
}
