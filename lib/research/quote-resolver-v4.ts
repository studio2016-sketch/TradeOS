import {referenceQuoteOutcome} from './quote-outcome-reference';
import {createHash} from 'node:crypto';
import {PROPOSED_ENTRY_CAPTURE_FINGERPRINT} from './proposed-entry-capture';
import {proposeQuoteOutcome, PROPOSED_QUOTE_OUTCOME_FINGERPRINT, type FrozenQuote} from './proposed-quote-outcome';

/** A distinct, unactivated research implementation; never dispatch v3 forecasts here. */
export const QUOTE_RESOLVER_V4_POLICY = {
 id:'tradeos.quote-resolver.v4.draft.2', activation:null,
 selector:PROPOSED_QUOTE_OUTCOME_FINGERPRINT, capture:PROPOSED_ENTRY_CAPTURE_FINGERPRINT,
 precision:'retain exact timestamp text; reject comparisons or ordering ambiguous at millisecond precision',
 endpointCap:10000, completeness:'exact PostgreSQL receipt deadline with overflow sentinel; earliest captured quote only',
 reference:'independent nanosecond parser, sorted conflict checks and linear endpoint selection; tolerance 1e-12 absolute plus relative',
 provenance:'readback entry equality and payload hashes; digest is not independent attestation',
 persistence:'read-only replay; no outcome insert, update, backfill or certification',
 bundle:'replayable typed rows, canonical SHA-256 checksum, explicit as-of; verify reports before use'
} as const;
export const QUOTE_RESOLVER_V4_FINGERPRINT=createHash('sha256').update(JSON.stringify(QUOTE_RESOLVER_V4_POLICY)).digest('hex');
export type EvidenceRow={id:string;symbol:string;source_id:string;received_at:string;metadata:{quoteTimestamp:string;bid:number;ask:number};payload_hash:string};
export type ReplayForecast={id:string;created_at:string;symbol:string;horizonMs:number;source_snapshot:{proposedQuoteEntry?:unknown}};
function canonical(v:any):string {
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
// Strict calendar and timezone validation, accepting PostgreSQL's timestamp spelling.
function exactTime(s:unknown):number|null {
 if(typeof s!=='string')return null;
 const m=s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}(?::?\d{2})?)$/);
 if(!m)return null;
 const [y,mo,d,h,mi,se]=m.slice(1,7).map(Number),day=new Date(Date.UTC(y,mo-1,d));
 if(y<1000||day.getUTCFullYear()!==y||day.getUTCMonth()!==mo-1||day.getUTCDate()!==d||h>23||mi>59||se>59)return null;
 const zone=m[8];
 if(zone!=='Z'){const digits=zone.slice(1).replace(':','');if(Number(digits.slice(0,2))>23||Number(digits.slice(2)||0)>59)return null;}
 const t=Date.parse(s);return Number.isFinite(t)?t:null;
}
function nanos(s:string):bigint {
 const fraction=s.match(/\.(\d{1,9})/)?.[1]??'';
 return BigInt(Date.parse(s))*BigInt(1000000)+BigInt((fraction.padEnd(9,'0')).slice(3)||'0');
}
function ambiguous(a:string,b:string,offsetMs=0){
 return Date.parse(a)===Date.parse(b)+offsetMs&&nanos(a)!==nanos(b)+BigInt(offsetMs)*BigInt(1000000);
}
function frozen(r:EvidenceRow):FrozenQuote{return {id:r.id,symbol:r.symbol,sourceId:r.source_id,quoteAt:r.metadata?.quoteTimestamp,receivedAt:r.received_at,bid:r.metadata?.bid,ask:r.metadata?.ask};}
const common={resolver:QUOTE_RESOLVER_V4_POLICY.id,resolverFingerprint:QUOTE_RESOLVER_V4_FINGERPRINT,activated:false,scientificallyEligible:false,sourceTimeCertified:false,independentlyCertified:false,eligibleForLive:false} as const;
const reject=(reason:string)=>({...common,status:'UNVERIFIED' as const,reason});

/** Offline replay of an explicit stored forecast, using the existing supplemental capture. */
export function replayQuoteOutcomeV4(f:ReplayForecast,asOf:string,entryRows:EvidenceRow[],endpointRows:EvidenceRow[],complete:boolean){
 if(!f||typeof f!=='object'||typeof f.id!=='string'||typeof f.symbol!=='string'||!Array.isArray(entryRows)||!Array.isArray(endpointRows)||entryRows.some(r=>!r||typeof r!=='object')||endpointRows.some(r=>!r||typeof r!=='object'))return reject('INVALID_REPLAY_INPUT');
 const capture=f.source_snapshot?.proposedQuoteEntry as any;
 if(!capture)return reject('NO_PROSPECTIVE_ENTRY_CAPTURE');
 if(capture.status!=='CAPTURED_PROPOSAL'||capture.policyFingerprint!==PROPOSED_ENTRY_CAPTURE_FINGERPRINT||capture.outcomeProposalFingerprint!==PROPOSED_QUOTE_OUTCOME_FINGERPRINT)return reject('UNSUPPORTED_CAPTURE_VERSION');
 const forecast=exactTime(f.created_at),cutoff=exactTime(capture.capturedAt),now=exactTime(asOf);
 if(forecast===null||cutoff===null||now===null||cutoff>forecast||now<forecast||!f.id?.trim()||!f.symbol?.trim()||!Number.isSafeInteger(f.horizonMs)||f.horizonMs<=0)return reject('INVALID_FORECAST_CHRONOLOGY');
 const entry=capture.entry as FrozenQuote;
 if(!entry||entry.symbol!==f.symbol||entry.sourceId!=='Alpaca:iex')return reject('ENTRY_IDENTITY_MISMATCH');
 if(exactTime(entry.quoteAt)===null||exactTime(entry.receivedAt)===null)return reject('INVALID_TIMESTAMP');
 const pairs:[string,string,number?][]=[
  [asOf,f.created_at],[capture.capturedAt,f.created_at],[entry.quoteAt,entry.receivedAt],
  [entry.quoteAt,capture.capturedAt],[entry.receivedAt,capture.capturedAt],
  [entry.quoteAt,f.created_at],[entry.receivedAt,f.created_at],
  [entry.quoteAt,f.created_at,-300000],[asOf,f.created_at,f.horizonMs+900000]
 ];
 if(pairs.some(([a,b,o])=>ambiguous(a,b,o)))return reject('AMBIGUOUS_TIMESTAMP_PRECISION');
 if(Date.parse(entry.receivedAt)>cutoff||Date.parse(entry.quoteAt)>cutoff)return reject('ENTRY_AFTER_CAPTURE');
 if(entryRows.length!==1||Object.entries(frozen(entryRows[0])).some(([key,value])=>value!==entry[key as keyof FrozenQuote]))return reject('ENTRY_READBACK_MISMATCH');
 if(complete!==true||endpointRows.length>QUOTE_RESOLVER_V4_POLICY.endpointCap)return reject('INCOMPLETE_ENDPOINT_RETRIEVAL');
 const identities=new Map<string,string>();
 for(const row of [...entryRows,...endpointRows]){
  if(row.symbol!==f.symbol||row.source_id!==entry.sourceId)return reject('CONFLICTING_SOURCE_IDENTITY');
  if(typeof row.payload_hash!=='string'||!row.payload_hash.trim())return reject('MISSING_EVIDENCE_PROVENANCE');
  const identity=canonical({...frozen(row),payloadHash:row.payload_hash}),previous=identities.get(row.id);
  if(previous&&previous!==identity)return reject('CONFLICTING_EVIDENCE_ID');
  identities.set(row.id,identity);
  if(exactTime(row.received_at)===null||exactTime(row.metadata?.quoteTimestamp)===null)return reject('INVALID_TIMESTAMP');
 }
 const quoteTimes=new Map<number,string>(),receiptTimes=new Map<number,string>();
 for(const q of [entry,...endpointRows.map(frozen)]){
  const comparisons:[string,string,number?][]=[
   [q.quoteAt,q.receivedAt],[q.receivedAt,asOf],
   [q.receivedAt,f.created_at,f.horizonMs+900000],
   [q.quoteAt,f.created_at,f.horizonMs],[q.quoteAt,f.created_at,f.horizonMs+900000]
  ];
  if(comparisons.some(([a,b,o])=>ambiguous(a,b,o)))return reject('AMBIGUOUS_TIMESTAMP_PRECISION');
  // The underlying selector orders milliseconds. Refuse a lossy tie instead of inventing order.
  for(const [stamp,seen] of [[q.quoteAt,quoteTimes],[q.receivedAt,receiptTimes]] as const){
   const key=Date.parse(stamp),previous=seen.get(key);
   if(previous&&nanos(previous)!==nanos(stamp))return reject('AMBIGUOUS_TIMESTAMP_PRECISION');
   seen.set(key,stamp);
  }
 }
 const input={forecastAt:f.created_at,horizonMs:f.horizonMs,asOf,frozenStart:entry,candidates:endpointRows.map(frozen),candidateSetComplete:true};
 const result=proposeQuoteOutcome(input);
 const reference=referenceQuoteOutcome(input);
 if(result.status!==reference.status)return reject('INDEPENDENT_REFERENCE_DISAGREEMENT');
 if(result.status==='REPRODUCIBLE_PROPOSAL'&&reference.status==='REPRODUCIBLE_PROPOSAL'){
  const close=(a:number,b:number)=>Math.abs(a-b)<=1e-12+1e-12*Math.max(Math.abs(a),Math.abs(b));
  if(result.start.id!==reference.entryId||result.end.id!==reference.endpointId||!close(result.realizedReturn,reference.realizedReturn)||!close(result.quotedRoundTripCost,reference.quotedRoundTripCost))return reject('INDEPENDENT_REFERENCE_DISAGREEMENT');
 }
 const referenceCheck={status:'AGREEMENT' as const,reference:'tradeos.quote-reference.v1',independentlyCertified:false,scope:'local implementation agreement only'};
 // Preserve row roles so the returned bundle is itself a complete offline replay input.
 const normalize=(r:EvidenceRow,kind:'entry'|'endpoint')=>({kind,id:r.id,symbol:r.symbol,source_id:r.source_id,received_at:r.received_at,
  metadata:{quoteTimestamp:r.metadata.quoteTimestamp,bid:r.metadata.bid,ask:r.metadata.ask},payload_hash:r.payload_hash});
 const rows=[...entryRows.map(r=>normalize(r,'entry')),...endpointRows.map(r=>normalize(r,'endpoint'))]
  .sort((a,b)=>canonical(a)<canonical(b)?-1:canonical(a)>canonical(b)?1:0);
 const bundle=JSON.parse(JSON.stringify({forecast:f,asOf,complete,policyFingerprint:QUOTE_RESOLVER_V4_FINGERPRINT,rows}));
 return {...result,...common,referenceCheck,forecastId:f.id,evidenceDigest:hash(bundle),evidenceBundle:bundle};
}

/** Read-only adapter. One SELECT gives entry + complete bounded endpoints in one DB snapshot.
 * A sentinel is counted before validation/deduplication. No provider fallback or writes. */
export async function loadQuoteOutcomeV4(sql:any,f:ReplayForecast,asOf:string){
 if(!f||typeof f!=='object')return reject('INVALID_REPLAY_REQUEST');
 const capture=f.source_snapshot?.proposedQuoteEntry as any,entry=capture?.entry;
 const t=exactTime(f.created_at),now=exactTime(asOf);
 if(!entry||t===null||now===null||!Number.isSafeInteger(f.horizonMs)||f.horizonMs<=0)return reject('INVALID_REPLAY_REQUEST');
 const deadline=t+f.horizonMs+900000;
 if(!Number.isSafeInteger(deadline)||deadline>8640000000000000)return reject('INVALID_REPLAY_REQUEST');
 // Compute the upper bound inside PostgreSQL using the original timestamp text.
 // Converting the forecast to Date would drop microseconds and omit eligible receipts.
 try{
  const rows=await sql`select kind,id,symbol,source_id,received_at,metadata,payload_hash from (
   (select 'entry' as kind,id::text as id,symbol,source_id,received_at::text as received_at,metadata,payload_hash
    from source_observations where id::text=${entry.id} and data_class='market_snapshot')
   union all
   (select 'endpoint' as kind,id::text as id,symbol,source_id,received_at::text as received_at,metadata,payload_hash
    from source_observations where data_class='market_snapshot' and symbol=${f.symbol} and source_id=${entry.sourceId}
    and received_at>=${f.created_at}::timestamptz and received_at<=least(${asOf}::timestamptz,${f.created_at}::timestamptz + ${f.horizonMs+900000}::double precision * interval '1 millisecond')
    order by received_at asc,id asc limit 10001)
  ) evidence`;
  const endpoints=rows.filter((r:any)=>r.kind==='endpoint');
  return replayQuoteOutcomeV4(f,asOf,rows.filter((r:any)=>r.kind==='entry'),endpoints,endpoints.length<=10000);
 }catch{return reject('EVIDENCE_READ_FAILED');}
}

/** Validate export envelopes before filtering so unknown kinds cannot hide dropped rows. */
export function replayQuoteExportV4(input:unknown,asOf:string){
 const x=input as any;
 if(!x||typeof x!=='object'||!Array.isArray(x.rows)||typeof x.complete!=='boolean'||!x.forecast||
  x.rows.some((r:any)=>!r||typeof r!=='object'||(r.kind!=='entry'&&r.kind!=='endpoint')))return reject('INVALID_EXPORT_ENVELOPE');
 return replayQuoteOutcomeV4(x.forecast,asOf,x.rows.filter((r:any)=>r.kind==='entry'),x.rows.filter((r:any)=>r.kind==='endpoint'),x.complete);
}

/** Verify an archived replay against its bundled evidence, without trusting its claimed result. */
export function verifyQuoteReplayV4(report:unknown){
 const r=report as any,bundle=r?.evidenceBundle;
 const bad=(reason:string)=>({status:'REJECTED' as const,reason,independentlyCertified:false});
 if(!bundle||bundle.policyFingerprint!==QUOTE_RESOLVER_V4_FINGERPRINT||typeof bundle.asOf!=='string'||
  typeof r.evidenceDigest!=='string'||r.evidenceDigest!==hash(bundle))return bad('BUNDLE_INTEGRITY_MISMATCH');
 const replay=replayQuoteExportV4(bundle,bundle.asOf);
 if(!('evidenceDigest' in replay)||replay.evidenceDigest!==r.evidenceDigest)return bad('BUNDLE_REPLAY_FAILED');
 for(const key of ['status','reason','forecastId','realizedReturn','quotedRoundTripCost','resolver','resolverFingerprint','method','methodFingerprint','asOf','forecastAt','horizonMs',
  'activated','scientificallyEligible','sourceTimeCertified','independentlyCertified','eligibleForLive','start','end','referenceCheck']){
  if(canonical(r[key]??null)!==canonical((replay as any)[key]??null))return bad('CLAIMED_RESULT_MISMATCH');
 }
 return {status:'REPRODUCED' as const,evidenceDigest:r.evidenceDigest,independentlyCertified:false};
}
