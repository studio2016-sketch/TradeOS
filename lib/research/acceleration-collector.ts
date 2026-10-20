import {FACTOR_KEYS,observedFactorCoverage} from "./acceleration-factors";
import {bestSnapshots} from "../market/live";
import {curatedNews} from "../market/news";
import {db} from "../db";
import {alpacaDailyHistory} from "./market-factor-history";
import {calculateMarketFactors} from "./market-factor-engine";
const START="2026-10-20T00:00:00Z",END="2026-10-27T00:00:00Z";
type Active={symbol:string;volume:number;trade_count:number};
export async function active100():Promise<{symbols:string[];mode:string;asOf:string}>{
 const sql=db();
 const frozen=await sql`select symbols,as_of,mode from tradeos_acceleration_universe where study_key='2026-10-20-volume-100'`;
 if(frozen.length)return {symbols:frozen[0].symbols as string[],mode:String(frozen[0].mode),asOf:new Date(frozen[0].as_of as string).toISOString()};
 const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
 if(!key||!secret)throw Error("Alpaca credentials missing; cannot rank 100 most active securities");
 const url="https://data.alpaca.markets/v1beta1/screener/stocks/most-actives?by=volume&top=100";
 const r=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("Alpaca most-actives HTTP "+r.status);
 const response=await r.json() as {most_actives?:Active[];last_updated?:string};
 const symbols=[...new Set((response.most_actives??[]).map(s=>s.symbol?.toUpperCase()).filter((s):s is string=>Boolean(s&&/^[A-Z0-9.-]{1,10}$/.test(s))))].slice(0,100);
 if(symbols.length<75)throw Error("Insufficient ranked universe coverage "+symbols.length);
 const asOf=response.last_updated||new Date().toISOString();
 await sql`insert into tradeos_acceleration_universe(study_key,symbols,as_of,mode) values('2026-10-20-volume-100',${JSON.stringify(symbols)}::jsonb,${asOf},'Frozen Alpaca top 100 by reported volume; not an options popularity rank') on conflict(study_key) do nothing`;
 const baseline=await sql`select symbols,as_of,mode from tradeos_acceleration_universe where study_key='2026-10-20-volume-100'`;
 return {symbols:baseline[0].symbols as string[],mode:String(baseline[0].mode),asOf:new Date(baseline[0].as_of as string).toISOString()};
}
export async function accelerationTick(now=new Date()){
 const timestamp=now.toISOString();
 if(timestamp<START||timestamp>=END)return {status:"outside_2026_10_20_to_10_26_window",observations:0};
 const universe=await active100();
 const slot=Math.floor(now.getTime()/900000);
 const batch=slot%10;
 const selected=universe.symbols.filter((_,i)=>i%10===batch);
 const snapshots=await bestSnapshots(selected);
 const news=await curatedNews(selected,30);
 // Historical fetch is bounded to the selected batch; unavailable history stays null.
 // Fetch only for usable snapshots, bounded to their actual market timestamps.
 const historyBySymbol=new Map<string,Awaited<ReturnType<typeof alpacaDailyHistory>>>();
 const eligible=snapshots.snapshots.filter(s=>{const t=Date.parse(s.timestamp);return Number.isFinite(t)&&t<=now.getTime()+5000&&now.getTime()-t<=600000;});
 // Cap concurrency to avoid a burst of historical API calls.
 for(let i=0;i<eligible.length;i+=2){
  await Promise.all(eligible.slice(i,i+2).map(async snap=>{
   historyBySymbol.set(snap.symbol,await alpacaDailyHistory(snap.symbol,snap.timestamp));
  }));
 }
 const sql=db();
 let saved=0,skipped=0,historyBars=0,derivedValues=0;
 const historyFailures:Record<string,number>={};
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
  const related=news.news.filter(n=>n.symbols.includes(snap.symbol)&&Number.isFinite(Date.parse(n.timestamp))&&Date.parse(n.timestamp)<=marketTime).slice(0,12);
  factors.headline_count=related.length;
  const history=historyBySymbol.get(snap.symbol);
  const derived=history?.bars.length?calculateMarketFactors(history.bars):{};
  historyBars+=history?.bars.length??0;
  if(!history?.bars.length){const reason=history?.error??"empty_history_or_ineligible_snapshot";historyFailures[reason]=(historyFailures[reason]??0)+1;}
  derivedValues+=Object.values(derived).filter(v=>v.value!==null).length;
  for(const [key,item] of Object.entries(derived))if(item.value!==null&&FACTOR_KEYS.some(known => known === key))factors[key]=item.value;
  const coverage=observedFactorCoverage(factors);
  const provenance={news:related.map(n=>({id:n.id,timestamp:n.timestamp,source:n.source,headline:n.headline})),errors:news.errors,history:{source:history?.source??"unavailable",error:history?.error??null,barCount:history?.bars.length??0},derivedFactors:derived};
  const runId=timestamp.slice(0,16)+":"+batch;
  const inserted=await sql`insert into tradeos_acceleration_observations(run_id,symbol,universe_rank,universe_as_of,market_time,price,provider,features,news,missing_factors) values(${runId},${snap.symbol},${rank+1},${universe.asOf},${snap.timestamp},${snap.price},${snap.source},${JSON.stringify(factors)}::jsonb,${JSON.stringify(provenance)}::jsonb,${JSON.stringify(coverage.missing)}::jsonb) on conflict(run_id,symbol) do nothing returning symbol`;
  saved+=inserted.length;
 }
 return {status:"observed_not_certified",timestamp,universeCount:universe.symbols.length,selection:universe.mode,batch,selected:selected.length,snapshotCount:snapshots.snapshots.length,historyEligible:eligible.length,saved,skipped,historyBars,derivedValues,historyFailures,newsErrors:news.errors,marketProvider:snapshots.provider,sourceAttempts:snapshots.attempts,executionAllowed:false};
}
