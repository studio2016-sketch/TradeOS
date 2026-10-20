import {historicalBars} from "../market/features";
import {db} from "../db";
import {active100} from "./acceleration-collector";
const END="2026-10-19T00:00:00Z";
const LOOKBACKS=[5,10,20,30,50];
const COSTS=[5,10,20];
export function historicalCandidate(closes:number[],lookback:number,contrarian:boolean,costBps:number){
 if(closes.length<lookback+80)throw Error("Insufficient time-ordered history");
 let equity=1,peak=1,maxDrawdown=0,total=0,benchmark=0,previousPosition=0,n=0;
 for(let t=lookback;t<closes.length-1;t++){
  const signal=closes[t]>closes[t-lookback]?1:0;
  const position=contrarian?1-signal:signal;
  const nextReturn=closes[t+1]/closes[t]-1;
  const turnover=Math.abs(position-previousPosition);
  const net=position*nextReturn-turnover*costBps/10000;
  equity*=1+net;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,1-equity/peak);
  total+=net;benchmark+=nextReturn;n++;previousPosition=position;
 }
 return {samples:n,meanNet:total/n,benchmarkMean:benchmark/n,maxDrawdown};
}
export async function accelerationReplay(now=new Date()){
 if(now.toISOString()>="2026-10-25T00:00:00Z")return {status:"four_day_replay_window_ended",trials:0};
 const universe=await active100();
 const batch=Math.floor(now.getTime()/3600000)%34;
 const symbols=universe.symbols.filter((_,i)=>i%34===batch);
 const sql=db();let trials=0,skipped=0;
 for(const symbol of symbols){
  try{
   const bars=await historicalBars(symbol,"1Day","2025-07-01T00:00:00Z",500,undefined,END);
   const closes=bars.filter(b=>b.t<END).map(b=>b.c);
   if(closes.length<135){skipped++;continue;}
   for(const lookback of LOOKBACKS)for(const costs of COSTS)for(const contrarian of [false,true]){
    const test=historicalCandidate(closes,lookback,contrarian,costs);
    await sql`insert into tradeos_acceleration_trials(symbol,dataset_end,strategy,lookback,costs_bps,sample_count,strategy_mean_net,benchmark_mean_net,strategy_max_drawdown,notes) values(${symbol},${END},${contrarian?"contrarian":"trend"},${lookback},${costs},${test.samples},${test.meanNet},${test.benchmarkMean},${test.maxDrawdown},'Exploratory daily close-to-close replay. Long/cash only; signal at close, next-close outcome; no exposure to forward data; no certification.') on conflict(symbol,dataset_end,strategy,lookback,costs_bps) do nothing`;
    trials++;
   }
  }catch{skipped++;}
 }
 return {status:"exploratory_only",batch,universeCount:universe.symbols.length,symbols:symbols.length,trialAttempts:trials,skipped,usesHistoricalPointInTimeFundamentals:false,independentValidation:false,ordersAllowed:false};
}
