import {FACTOR_KEYS,observedFactorCoverage} from "./acceleration-factors";
import {bestSnapshots} from "../market/live";
import {curatedNews} from "../market/news";
import {db} from "../db";
const START="2026-10-20T00:00:00Z",END="2026-10-26T00:00:00Z";
const fallback=["NVDA","TSLA","AAPL","AMD","MSFT","AMZN","META","GOOGL","PLTR","AVGO","SPY","QQQ","IWM","MU","INTC","SMCI","NFLX","COIN","HOOD","SOFI"];
type Active={symbol:string;volume:number;trade_count:number};
async function active100():Promise<{symbols:string[];mode:string;asOf:string}>{
 const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
 if(!key||!secret)throw Error("Alpaca credentials missing; cannot rank 100 most active securities");
 const url="https://data.alpaca.markets/v1beta1/screener/stocks/most-actives?by=volume&top=100";
 const r=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("Alpaca most-actives HTTP "+r.status);
 const response=await r.json() as {most_actives?:Active[];last_updated?:string};
 const symbols=[...new Set((response.most_actives??[]).map(s=>s.symbol?.toUpperCase()).filter((s):s is string=>Boolean(s&&/^[A-Z0-9.-]{1,10}$/.test(s))))].slice(0,100);
 if(symbols.length<75)throw Error("Insufficient ranked universe coverage "+symbols.length);
 return {symbols,mode:"Alpaca most actives by trading volume (dynamic, not popularity polling)",asOf:response.last_updated||new Date().toISOString()};
}
export async function accelerationTick(now=new Date()){
 const timestamp=now.toISOString();
 if(timestamp<START||timestamp>=END)return {status:"outside_2026_10_20_to_10_25_window",observations:0};
 const universe=await active100();
 const slot=Math.floor(now.getTime()/900000);
 const batch=slot%10;
 const selected=universe.symbols.filter((_,i)=>i%10===batch);
 const snapshots=await bestSnapshots(selected);
 const news=await curatedNews(selected,30);
 const sql=db();
 let saved=0,skipped=0;
 for(const snap of snapshots.snapshots){
  const rank=universe.symbols.indexOf(snap.symbol);
  const marketTime=Date.parse(snap.timestamp),age=now.getTime()-marketTime;
  if(rank<0||!Number.isFinite(snap.price)||snap.price<=0||!Number.isFinite(marketTime)||age< -5000||age>600000){skipped++;continue;}
  const factors:Record<string,number|null>=Object.fromEntries(FACTOR_KEYS.map(k=>[k,null]));
  if(Number.isFinite(snap.volume))factors.daily_volume=snap.volume;
  if(Number.isFinite(snap.vwap)&&snap.vwap!>0)factors.distance_vwap=(snap.price-snap.vwap!)/snap.vwap!;
  if(Number.isFinite(snap.bid)&&Number.isFinite(snap.ask)&&snap.ask!>=snap.bid!&&snap.bid!>0){
   factors.bid_ask_spread=snap.ask!-snap.bid!;
   factors.spread_bps=(snap.ask!-snap.bid!)/((snap.ask!+snap.bid!)/2)*10000;
  }
  const related=news.news.filter(n=>n.symbols.includes(snap.symbol)).slice(0,12);
  factors.headline_count=related.length;
  const coverage=observedFactorCoverage(factors);
  const provenance={news:related.map(n=>({id:n.id,timestamp:n.timestamp,source:n.source,headline:n.headline})),errors:news.errors};
  const runId=timestamp.slice(0,16)+":"+batch;
  await sql`insert into tradeos_acceleration_observations(run_id,symbol,universe_rank,universe_as_of,market_time,price,provider,features,news,missing_factors) values(${runId},${snap.symbol},${rank+1},${universe.asOf},${snap.timestamp},${snap.price},${snap.source},${JSON.stringify(factors)}::jsonb,${JSON.stringify(provenance)}::jsonb,${JSON.stringify(coverage.missing)}::jsonb) on conflict(run_id,symbol) do nothing`;
  saved++;
 }
 return {status:"observed_not_certified",timestamp,universeCount:universe.symbols.length,selection:universe.mode,batch,selected:selected.length,saved,skipped,newsErrors:news.errors,marketProvider:snapshots.provider,sourceAttempts:snapshots.attempts,executionAllowed:false};
}
