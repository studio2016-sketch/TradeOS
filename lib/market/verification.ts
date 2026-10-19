import {db} from "../db";
import {bestSnapshots} from "./live";

function credentials(){return Boolean(process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET)}
function tradingBase(){
  return process.env.ALPACA_TRADING_ENV==="live"?"https://api.alpaca.markets":"https://paper-api.alpaca.markets";
}
export async function alpacaMarketClock(){
  if(!credentials())return null;
  const headers={"APCA-API-KEY-ID":process.env.ALPACA_API_KEY!,"APCA-API-SECRET-KEY":process.env.ALPACA_API_SECRET!,"Accept":"application/json"};
  const res=await fetch(tradingBase()+"/v2/clock",{headers,cache:"no-store"});
  if(!res.ok)throw new Error(`Alpaca clock HTTP ${res.status}`);
  const c=await res.json() as any;
  return{timestamp:String(c.timestamp??""),isOpen:Boolean(c.is_open),nextOpen:String(c.next_open??""),nextClose:String(c.next_close??"")};
}

export async function verifyOpenMarketAdvancement(symbols:string[]=["SPY","QQQ","NVDA"]){
  const clock=await alpacaMarketClock().catch(()=>null);
  const market=await bestSnapshots(symbols).catch(()=>({provider:null,snapshots:[],attempts:[] as any[]}));
  const sql=db();
  const checks:any[]=[];
  for(const symbol of symbols){
    let rows:any[]=[];
    try{
      rows=await sql`
        select event_time,received_at,source_id,metadata
        from source_observations
        where data_class='market_snapshot' and symbol=${symbol}
        order by received_at desc
        limit 3
      ` as any[];
    }catch(_){rows=[];}
    const distinct=rows.filter((r,i,a)=>i===0||new Date(r.event_time).getTime()!==new Date(a[i-1]?.event_time).getTime());
    const latest=distinct[0],previous=distinct[1];
    const current=market.snapshots.find((x:any)=>x.symbol===symbol);
    const storedAdvanced=Boolean(latest&&previous&&new Date(latest.event_time).getTime()>new Date(previous.event_time).getTime());
    const providerAdvanced=Boolean(current&&latest&&new Date(current.timestamp).getTime()>new Date(latest.event_time).getTime());
    checks.push({
      symbol,
      currentProviderTimestamp:current?.timestamp??null,
      latestStoredTimestamp:latest?.event_time??null,
      previousStoredTimestamp:previous?.event_time??null,
      storedAdvanced,providerAdvanced,
      freshCurrent:Boolean(current&&Date.now()-new Date(current.timestamp).getTime()<120000)
    });
  }
  let status:"MARKET_CLOSED_PENDING"|"VERIFIED_ADVANCING"|"OPEN_NOT_ADVANCING"|"INSUFFICIENT_EVIDENCE";
  if(clock&&!clock.isOpen)status="MARKET_CLOSED_PENDING";
  else if(clock?.isOpen&&checks.every(c=>(c.providerAdvanced||c.storedAdvanced)&&c.freshCurrent))status="VERIFIED_ADVANCING";
  else if(clock?.isOpen&&checks.some(c=>!c.freshCurrent||(!c.providerAdvanced&&!c.storedAdvanced)))status="OPEN_NOT_ADVANCING";
  else status="INSUFFICIENT_EVIDENCE";
  return{
    status,clock,provider:market.provider,checks,
    verified:status==="VERIFIED_ADVANCING",
    generatedAt:new Date().toISOString(),
    policy:"Verification requires an open Alpaca market clock, fresh provider timestamps, and observed timestamp advancement. API reachability alone is insufficient."
  };
}
