import {historicalBars} from "../market/features";
import {db} from "../db";
import {active100} from "./acceleration-collector";
import {randomUUID} from "node:crypto";
const END="2026-10-19T00:00:00Z";
const CUTOFF="2026-10-25T00:00:00Z";
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
 const sql=db();
 const runId=randomUUID();
 let batch:number|null=null,universeCount=0,selected:string[]=[];
 let attempted=0,inserted=0,historicalBarCount=0;
 const skipped:string[]=[],errors:{symbol:string;reason:string}[]=[];
 let status="exploratory_only";
 try {
  if(now.toISOString()>=CUTOFF){status="replay_window_ended";}
  else {
   const universe=await active100();
   universeCount=universe.symbols.length;
   batch=Math.floor(now.getTime()/3600000)%34;
   selected=universe.symbols.filter((_,i)=>i%34===batch);
   for(const symbol of selected){
    try {
     const bars=await historicalBars(symbol,"1Day","2025-07-01T00:00:00Z",500,undefined,END);
     const closes=bars.filter(b=>b.t<END).map(b=>b.c);
     historicalBarCount+=closes.length;
     if(closes.length<135){skipped.push(symbol);errors.push({symbol,reason:"insufficient_history"});continue;}
     for(const lookback of LOOKBACKS)for(const costs of COSTS)for(const contrarian of [false,true]){
      const test=historicalCandidate(closes,lookback,contrarian,costs);
      attempted++;
      const rows=await sql`insert into tradeos_acceleration_trials(symbol,dataset_end,strategy,lookback,costs_bps,sample_count,strategy_mean_net,benchmark_mean_net,strategy_max_drawdown,notes) values(${symbol},${END},${contrarian?"contrarian":"trend"},${lookback},${costs},${test.samples},${test.meanNet},${test.benchmarkMean},${test.maxDrawdown},'Exploratory daily close-to-close replay; not independently validated.') on conflict(symbol,dataset_end,strategy,lookback,costs_bps) do nothing returning symbol`;
      inserted+=rows.length;
     }
    }catch(e){skipped.push(symbol);errors.push({symbol,reason:e instanceof Error?e.message:"unknown_error"});}
   }
  }
 }catch(e){status="replay_failed";errors.push({symbol:"_run",reason:e instanceof Error?e.message:"unknown_error"});}
 // Receipt write is mandatory: a missing migration or DB error must fail the endpoint, not simulate success.
 await sql`insert into tradeos_acceleration_replay_receipts(run_id,executed_at,status,batch,universe_count,selected_symbols,attempted_trials,inserted_trials,historical_bars,skipped_symbols,errors)
 values(${runId},${now.toISOString()},${status},${batch},${universeCount},${selected},${attempted},${inserted},${historicalBarCount},${skipped},${JSON.stringify(errors)}::jsonb)`;
 if(status==="replay_failed")throw Error("Replay failed; see persisted receipt "+runId);
 return {status,runId,batch,universeCount,selectedSymbols:selected.length,trialAttempts:attempted,insertedTrials:inserted,historicalBars:historicalBarCount,skippedSymbols:skipped,errors,independentValidation:false,ordersAllowed:false};
}
