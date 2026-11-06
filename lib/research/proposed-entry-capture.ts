import {createHash} from 'node:crypto';
import {PROPOSED_QUOTE_OUTCOME_FINGERPRINT,type FrozenQuote} from './proposed-quote-outcome';

export const PROPOSED_ENTRY_CAPTURE_POLICY={id:'tradeos.proposed-entry-capture.v1',allowedSources:['Alpaca:iex'],maxAgeMs:300_000,candidateCap:1000,selection:'latest quote time at millisecond precision, then earliest receipt at millisecond precision, then lexical observation ID',scope:'inactive supplemental capture; not validated against eventual forecast creation'} as const;
export const PROPOSED_ENTRY_CAPTURE_FINGERPRINT=createHash('sha256').update(JSON.stringify(PROPOSED_ENTRY_CAPTURE_POLICY)).digest('hex');
type Row={id:unknown;symbol:unknown;source_id:unknown;received_at:unknown;metadata:unknown};
function time(x:unknown){
 if(typeof x!=='string')return NaN;
 const m=x.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/);
 if(!m)return NaN;
 const [y,mo,d,h,mi,s]=m.slice(1).map(Number),calendar=new Date(Date.UTC(y,mo-1,d));
 if(y<1000||calendar.getUTCFullYear()!==y||calendar.getUTCMonth()!==mo-1||calendar.getUTCDate()!==d||h>23||mi>59||s>59)return NaN;
 return Date.parse(x);
}

export function captureProposedEntry(symbol:string,cutoff:string,rows:Row[]){
 const common={policy:PROPOSED_ENTRY_CAPTURE_POLICY.id,policyFingerprint:PROPOSED_ENTRY_CAPTURE_FINGERPRINT,outcomeProposalFingerprint:PROPOSED_QUOTE_OUTCOME_FINGERPRINT,capturedAt:cutoff,activated:false,validatedForForecast:false,sourceTimeCertified:false} as const;
 const unavailable=(reason:string)=>({...common,status:'UNAVAILABLE' as const,reason,entry:null});
 const end=time(cutoff),start=end-PROPOSED_ENTRY_CAPTURE_POLICY.maxAgeMs;
 if(!Number.isFinite(end)||!symbol.trim())return unavailable('INVALID_CAPTURE_REQUEST');
 if(rows.length>PROPOSED_ENTRY_CAPTURE_POLICY.candidateCap)return unavailable('CANDIDATE_LIMIT_EXCEEDED');
 const eligible:FrozenQuote[]=[];
 for(const row of rows){
  if(row.symbol!==symbol||!PROPOSED_ENTRY_CAPTURE_POLICY.allowedSources.includes(row.source_id as 'Alpaca:iex'))continue;
  const receipt=time(row.received_at);
  if(!Number.isFinite(receipt))return unavailable('INVALID_RECEIPT_TIME');
  if(receipt<start||receipt>end)continue;
  const m=row.metadata as any,qt=time(m?.quoteTimestamp);
  if(!Number.isFinite(qt))return unavailable('INVALID_QUOTE_TIME');
  if(qt<start||qt>end)continue;
  if(qt>receipt)return unavailable('QUOTE_AFTER_RECEIPT');
  if(typeof row.id!=='string'||!row.id.trim()||!Number.isFinite(m.bid)||!Number.isFinite(m.ask)||m.bid<=0||m.ask<m.bid)return unavailable('INVALID_QUOTE');
  eligible.push({id:row.id,symbol,sourceId:String(row.source_id),quoteAt:m.quoteTimestamp,receivedAt:String(row.received_at),bid:m.bid,ask:m.ask});
 }
 const ids=new Map<string,FrozenQuote>(),times=new Map<string,FrozenQuote>();
 for(const q of eligible){
  const a=ids.get(q.id),b=times.get(String(time(q.quoteAt)));
  if(a&&JSON.stringify(a)!==JSON.stringify(q))return unavailable('CONFLICTING_OBSERVATION_ID');
  if(b&&(b.bid!==q.bid||b.ask!==q.ask))return unavailable('CONFLICTING_QUOTE_TIMESTAMP');
  ids.set(q.id,q);times.set(String(time(q.quoteAt)),q);
 }
 const selected=[...ids.values()].sort((a,b)=>time(b.quoteAt)-time(a.quoteAt)||time(a.receivedAt)-time(b.receivedAt)||(a.id<b.id?-1:a.id>b.id?1:0))[0];
 return selected?{...common,status:'CAPTURED_PROPOSAL' as const,reason:'ENTRY_VALID_AT_CAPTURE_ONLY',entry:selected}:unavailable('NO_ELIGIBLE_QUOTE');
}

/** Read-only DB collection, independent of model lookback and future endpoint availability. */
export async function loadProposedEntry(sql:any,symbol:string,cutoff:string){
 try{
  const from=new Date(Date.parse(cutoff)-PROPOSED_ENTRY_CAPTURE_POLICY.maxAgeMs).toISOString();
  const rows=await sql`select id::text as id,symbol,source_id,received_at::text as received_at,metadata
   from source_observations where data_class='market_snapshot' and symbol=${symbol}
   and received_at>=${from}::timestamptz and received_at<=${cutoff}::timestamptz
   order by received_at asc,id asc limit 1001`;
  return captureProposedEntry(symbol,cutoff,rows);
 }catch{
  return {...captureProposedEntry(symbol,cutoff,[]),status:'UNAVAILABLE' as const,reason:'CAPTURE_READ_FAILED',entry:null};
 }
}
