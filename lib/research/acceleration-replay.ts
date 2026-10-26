import {historicalBars} from "../market/features";
import {db} from "../db";
import {active100} from "./acceleration-collector";
const START="2025-07-01T00:00:00Z";
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
 // Use only completed historical daily bars; never include today's incomplete session.
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).toISOString();
 const universe=await active100();
 const batch=Math.floor(now.getTime()/3600000)%34;
 const symbols=universe.symbols.filter((_,i)=>i%34===batch);
 const sql=db();let trialAttempts=0,insertedTrials=0,skipped=0;
 const failures:{symbol:string;reason:string}[]=[];
 for(const symbol of symbols){
  try{
   const bars=await historicalBars(symbol,"1Day",START,500,undefined,end);
   const validBars=bars.filter(b=>b.t<end&&Number.isFinite(Date.parse(b.t))&&Number.isFinite(b.c)&&b.c>0).sort((a,b)=>a.t.localeCompare(b.t));
   if(validBars.length<135){skipped++;continue;}
   if(new Set(validBars.map(b=>b.t)).size!==validBars.length)throw Error("Duplicate historical bar timestamps");
   const latestBar=validBars[validBars.length-1].t;
   const datasetEnd=new Date(latestBar).toISOString();
   const closes=validBars.map(b=>b.c);
   for(const lookback of LOOKBACKS)for(const costs of COSTS)for(const contrarian of [false,true]){
    const test=historicalCandidate(closes,lookback,contrarian,costs);
    trialAttempts++;
    const rows=await sql`insert into tradeos_acceleration_trials(symbol,dataset_end,strategy,lookback,costs_bps,sample_count,strategy_mean_net,benchmark_mean_net,strategy_max_drawdown,notes) values(${symbol},${datasetEnd},${contrarian?"contrarian":"trend"},${lookback},${costs},${test.samples},${test.meanNet},${test.benchmarkMean},${test.maxDrawdown},'Exploratory daily close-to-close replay; not causal or independently validated; no orders allowed.') on conflict(symbol,dataset_end,strategy,lookback,costs_bps) do nothing returning id`;
    insertedTrials+=rows.length;
   }
  }catch(e){
   skipped++;
   failures.push({symbol,reason:e instanceof Error?e.message:"unknown_error"});
  }
 }
 return {status:failures.length?"exploratory_partial_failure":"exploratory_only",
  requestedEnd:end,batch,universeCount:universe.symbols.length,
  symbolsAttempted:symbols.length,trialAttempts,insertedTrials,
  existingTrials:trialAttempts-insertedTrials,skipped,failures,
  usesHistoricalPointInTimeFundamentals:false,independentValidation:false,ordersAllowed:false};
}
