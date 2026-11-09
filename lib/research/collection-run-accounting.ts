import {evidenceTimestamp} from './evidence-time';

type Candidate={symbol:string;sourceId:string;priceAt:string;quoteAt:string|null;selectionEligible:boolean;selected:boolean};
type Write={symbol:string;sourceId:string;priceAt:string;quoteAt:string|null;persistence:'INSERTED'|'CONFLICT_NO_INSERT'|'NOT_COMPLETED'};
type TelemetryRun={finishedAt:string;marketSelection?:unknown;marketPersistence?:unknown};
const text=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0;
const quote=(x:unknown)=>x===null||typeof x==='string';
function selectedShape(x:any){return x&&text(x.symbol)&&text(x.sourceId)&&typeof x.priceAt==='string'&&quote(x.quoteAt);}

/** Validate normalized audit attribution without treating provider timestamps as certified receipts. */
export function parseCollectionRunAccounting(run:TelemetryRun){
 const selection=run.marketSelection,persistence=run.marketPersistence as any;
 if(evidenceTimestamp(run.finishedAt)===null)return {status:'INVALID' as const};
 if(selection==null&&persistence==null)return {status:'UNAVAILABLE' as const};
 if(selection!=null&&(!Array.isArray(selection)||selection.length>150))return {status:'INVALID' as const};
 if(persistence!=null&&(persistence.schema!=='tradeos.market-persistence.v1'||!Array.isArray(persistence.selected)||persistence.selected.length>50))return {status:'INVALID' as const};
 const candidates=(selection??[]) as Candidate[],writes=(persistence?.selected??[]) as Write[];
 if(!candidates.every(c=>selectedShape(c)&&typeof c.selectionEligible==='boolean'&&typeof c.selected==='boolean'&&(!c.selected||c.selectionEligible))||
  !writes.every(w=>selectedShape(w)&&['INSERTED','CONFLICT_NO_INSERT','NOT_COMPLETED'].includes(w.persistence)))return {status:'INVALID' as const};
 if(selection==null||persistence==null)return {status:'PARTIAL' as const};
 const winners=candidates.filter(c=>c.selected);
 if(new Set(winners.map(c=>c.symbol)).size!==winners.length||new Set(writes.map(w=>w.symbol)).size!==writes.length||winners.length!==writes.length)return {status:'INVALID' as const};
 for(const w of writes){
  const c=winners.find(c=>c.symbol===w.symbol);
  if(!c||c.sourceId!==w.sourceId||c.priceAt!==w.priceAt||c.quoteAt!==w.quoteAt)return {status:'INVALID' as const};
 }
 return {status:'AVAILABLE' as const,candidates,writes};
}

/** Counts describe logged normalization/selection, never recover a usable frozen endpoint. */
export function collectionRunAccounting(runs:TelemetryRun[],symbol:string,sourceId:string,horizon:bigint,deadline:bigint){
 const parsed=runs.map(run=>({run,parsed:parseCollectionRunAccounting(run)}));
 if(parsed.some(x=>x.parsed.status==='INVALID'))return {status:'INVALID',runsWithTelemetry:0,runsWithoutTelemetry:runs.length,counts:null,scope:'Malformed audit accounting cannot support attribution.'};
 const available=parsed.filter(x=>x.parsed.status==='AVAILABLE');
 const missing=runs.length-available.length;
 const counts={matchingSourceCandidates:0,preHorizonQuoteCandidates:0,windowQuoteCandidatesNotSelected:0,unknownOrFutureQuoteCandidates:0,
  matchingSourceSelectedInserted:0,matchingSourceSelectedConflicts:0,matchingSourceSelectedNotCompleted:0};
 for(const {run,parsed:p} of available){
  if(p.status!=='AVAILABLE')continue;
  const finished=evidenceTimestamp(run.finishedAt)!;
  for(const c of p.candidates){
   if(c.symbol!==symbol||c.sourceId!==sourceId)continue;
   counts.matchingSourceCandidates++;
   const time=evidenceTimestamp(c.quoteAt);
   if(time===null||time>finished){counts.unknownOrFutureQuoteCandidates++;continue;}
   if(time<horizon)counts.preHorizonQuoteCandidates++;
   if(time>=horizon&&time<=deadline&&!c.selected)counts.windowQuoteCandidatesNotSelected++;
  }
  for(const w of p.writes){
   if(w.symbol!==symbol||w.sourceId!==sourceId)continue;
   if(w.persistence==='INSERTED')counts.matchingSourceSelectedInserted++;
   if(w.persistence==='CONFLICT_NO_INSERT')counts.matchingSourceSelectedConflicts++;
   if(w.persistence==='NOT_COMPLETED')counts.matchingSourceSelectedNotCompleted++;
  }
 }
 return {status:available.length?(missing?'PARTIAL':'AVAILABLE'):'UNAVAILABLE',runsWithTelemetry:available.length,runsWithoutTelemetry:missing,
  counts:available.length?counts:null,scope:'Normalized candidate and write accounting only; no provider receipt-time, valid-price or source-completeness certification.'};
}
