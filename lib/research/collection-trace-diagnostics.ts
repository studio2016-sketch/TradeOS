import {evidenceTimestamp} from './evidence-time';
import {receiptDelayDiagnostics,RECEIPT_DIAGNOSTIC_POLICY} from './receipt-delay-diagnostics';
import {collectionRunAccounting,parseCollectionRunAccounting} from './collection-run-accounting';

type Attempt={source:string;count?:number;error?:string};
type Run={id:string;recordedAt:string;startedAt:string;finishedAt:string;symbols:string[];attempts:Attempt[];errors:unknown[];saved:number;marketSelection?:unknown;marketPersistence?:unknown};
const text=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0;
const integer=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>=0;

/** Read-only correlation of stored winners and ingestion audit records; never infers an exchange outage. */
export function collectionTraceDiagnostics(raw:unknown){
 const input=raw as any;
 const timing=receiptDelayDiagnostics(input?.timing);
 const reject=(reason:string)=>({status:'UNVERIFIED' as const,reason,activated:false,scientificallyCertified:false,eligibleForLive:false});
 if(timing.status!=='DIAGNOSTIC_ONLY')return reject('INVALID_TIMING_EXPORT');
 const c=input?.collection,asOf=evidenceTimestamp(timing.asOf)!;
 const from=evidenceTimestamp(c?.from),through=evidenceTimestamp(c?.through);
 if(!c||typeof c.retrievalComplete!=='boolean'||from===null||through===null||from>through||through>asOf||!Array.isArray(c.runs)||c.runs.length>10000)return reject('INVALID_COLLECTION_EXPORT');
 if(c.runs.length*timing.forecasts.length>RECEIPT_DIAGNOSTIC_POLICY.maxComparisons)return reject('DIAGNOSTIC_LIMIT_EXCEEDED');
 const runs=new Map<string,{run:Run;start:bigint}>();
 for(const r of c.runs as Run[]){
  const start=evidenceTimestamp(r?.startedAt),end=evidenceTimestamp(r?.finishedAt),recorded=evidenceTimestamp(r?.recordedAt);
  if(!r||!text(r.id)||start===null||end===null||recorded===null||start>end||end>recorded||recorded>asOf||
   !Array.isArray(r.symbols)||!r.symbols.every(text)||!Array.isArray(r.errors)||!integer(r.saved)||!Array.isArray(r.attempts)||
   !r.attempts.every(a=>a&&text(a.source)&&(a.count===undefined||integer(a.count))&&(a.error===undefined||text(a.error))))return reject('INVALID_COLLECTION_RUN');
  if(parseCollectionRunAccounting(r).status==='INVALID')return reject('INVALID_COLLECTION_RUN_ACCOUNTING');
  const previous=runs.get(r.id);
  if(previous&&JSON.stringify(previous.run)!==JSON.stringify(r))return reject('CONFLICTING_COLLECTION_RUN_ID');
  runs.set(r.id,{run:r,start});
 }
 const forecasts=new Map(input.timing.forecasts.map((f:any)=>[f.id,f]));
 const observations=new Map<string,any>(input.timing.observations.filter((o:any)=>evidenceTimestamp(o.receivedAt)!<=asOf).map((o:any)=>[o.id,o]));
 const reports=timing.forecasts.filter(f=>f.status==='NO_CAPTURED_ENDPOINT').map(f=>{
  const original=forecasts.get(f.forecastId) as any;
  const horizon=evidenceTimestamp(original.created_at)!+BigInt(original.horizonMs)*BigInt(1000000);
  const deadline=horizon+BigInt(RECEIPT_DIAGNOSTIC_POLICY.graceMs)*BigInt(1000000);
  const common={forecastId:f.forecastId,symbol:f.symbol,horizonNanoseconds:horizon.toString(),deadlineNanoseconds:deadline.toString()};
  if(!c.retrievalComplete||from>horizon||through<deadline)return {...common,status:'NOT_ASSESSED',reason:'INCOMPLETE_COLLECTION_WINDOW',matchingStoredReceipts:null,completedRunsStartedInWindow:null,alpacaResponseRuns:null,runsWithRecordedErrors:null,maxStartGapIncludingWindowEdgesNanoseconds:null,otherStoredFeeds:null,otherFeedStoredReceipts:null,otherFeedOnTimeQuoteReceipts:null,candidateAccounting:null};
  const windowRuns=[...runs.values()].filter(r=>r.start>=horizon&&r.start<=deadline&&r.run.symbols.includes(f.symbol)).sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
  const other=[...observations.values()].filter(o=>o.symbol===f.symbol&&o.sourceId!==f.sourceId&&evidenceTimestamp(o.receivedAt)!>=horizon&&evidenceTimestamp(o.receivedAt)!<=deadline);
  const starts=[horizon,...windowRuns.map(r=>r.start),deadline];
  let maxGap=BigInt(0);for(let i=1;i<starts.length;i++)if(starts[i]-starts[i-1]>maxGap)maxGap=starts[i]-starts[i-1];
  return {...common,status:'TRACE_ONLY',matchingStoredReceipts:f.receiptsDuringWindow,
   completedRunsStartedInWindow:windowRuns.length,
   alpacaResponseRuns:windowRuns.filter(r=>r.run.attempts.some(a=>a.source==='Alpaca'&&!a.error&&(a.count??0)>0)).length,
   runsWithRecordedErrors:windowRuns.filter(r=>r.run.errors.length||r.run.attempts.some(a=>a.error&&!['unconfigured','disabled_by_entitlement_policy'].includes(a.error))).length,
   maxStartGapIncludingWindowEdgesNanoseconds:maxGap.toString(),
   candidateAccounting:collectionRunAccounting(windowRuns.map(r=>r.run),f.symbol,f.sourceId!,horizon,deadline),
   otherStoredFeeds:[...new Set(other.map(o=>o.sourceId))].sort(),otherFeedStoredReceipts:other.length,
   otherFeedOnTimeQuoteReceipts:other.filter(o=>evidenceTimestamp(o.quoteAt)!>=horizon&&evidenceTimestamp(o.quoteAt)!<=deadline).length};
 });
 return {status:'DIAGNOSTIC_ONLY',policy:'tradeos.collection-trace.v2',activated:false,scientificallyCertified:false,eligibleForLive:false,timingSummary:timing.summary,forecasts:reports,
  limitations:['Run starts, completion and aggregate response counts do not prove per-symbol feed success or complete polling.','Only selected, nonduplicate snapshots are stored; discarded provider responses cannot be reconstructed.','Other feeds are context only and cannot replace frozen-source endpoints.','Completeness covers supplied stored rows and run-start interval only; no feed completeness or scientific certification.']};
}
