import {isDeepStrictEqual} from 'node:util';
import {dailyCollectionPlan,dailySymbolEvidence,DAILY_COLLECTION_POLICY,DAILY_SYMBOLS,DAILY_KEYS} from './daily-factor-collection';
import {evidenceTimestamp} from './evidence-time';

/** Verifier versions do not change collection policy, stored hashes, or scientific authority. */
export const DAILY_RECEIPT_REPLAY_VERSION='tradeos.daily-receipt-replay.v1';
export const LEGACY_DAILY_INPUT_SERIALIZATION='tradeos.alpaca-pricebar-json.v0';
const BAR_KEYS=['timestamp','open','high','low','close','volume'] as const;
type Failure='invalid_receipt'|'scope_mismatch'|'chronology_mismatch'|'unsupported_serialization'|'history_invalid'|'input_hash_mismatch'|'evidence_mismatch';
const failures=new Set<Failure>(['invalid_receipt','scope_mismatch','chronology_mismatch','unsupported_serialization','history_invalid','input_hash_mismatch','evidence_mismatch']);
function requireCheck(ok:unknown,code:Failure):asserts ok {if(!ok)throw Error(code);}
function record(v:unknown):Record<string,any>{requireCheck(v!==null&&typeof v==='object'&&!Array.isArray(v),'invalid_receipt');return v as Record<string,any>;}
function timestamp(v:unknown){requireCheck(typeof v==='string','chronology_mismatch');const ns=evidenceTimestamp(v);requireCheck(ns!==null,'chronology_mismatch');return ns;}
/** Reconstruct only the original adapter's exact six-field serialization after JSONB key reordering.
 * Unversioned receipts belong to that original adapter. Unknown versions fail closed.
 * Values, timestamp spelling and array order are never repaired or normalized.
 */
export function restoreLegacyDailyInput(bars:unknown,version:unknown=undefined){
 requireCheck(version===undefined||version===LEGACY_DAILY_INPUT_SERIALIZATION,'unsupported_serialization');
 requireCheck(Array.isArray(bars)&&bars.length===200,'history_invalid');
 let previous:bigint|undefined;
 return bars.map(value=>{
  const b=record(value);
  requireCheck(Object.keys(b).sort().join(',')===[...BAR_KEYS].sort().join(','),'history_invalid');
  const time=timestamp(b.timestamp);requireCheck(previous===undefined||time>previous,'history_invalid');previous=time;
  // This order must remain identical to market-factor-history.ts's original PriceBar adapter.
  return {timestamp:b.timestamp,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume};
 });
}
/** Pure read-only verification of a complete strict pilot receipt. No DB/provider/clock side effects.
 * Accept a JSON snapshot {claim,completion,evidence} from the durable tables, never an HTTP success alone.
 */
export function replayDailyReceipt(input:unknown){
 const assurance={verificationVersion:DAILY_RECEIPT_REPLAY_VERSION,ordersAllowed:false as const,certified:false as const};
 try{
  const r=record(input),claim=record(r.claim),completion=record(r.completion),d=record(completion.details);
  requireCheck(claim.policy===DAILY_COLLECTION_POLICY&&d.policy===claim.policy&&d.session===claim.session&&completion.session===claim.session,'scope_mismatch');
  const started=timestamp(claim.started_at),expires=timestamp(claim.expires_at),finished=timestamp(d.finishedAt);
  requireCheck(timestamp(d.startedAt)===started&&finished>=started&&finished<expires,'chronology_mismatch');
  const plan=dailyCollectionPlan(new Date(claim.started_at));
  requireCheck(plan.session===claim.session&&timestamp(plan.startedAt)===started&&timestamp(plan.expiresAt)===expires&&d.sessionClose===plan.sessionClose,'scope_mismatch');
  requireCheck(d.executionAllowed===false&&d.scientificallyCertified===false&&d.syntheticFixture===undefined,'scope_mismatch');
  requireCheck(Number.isInteger(completion.saved)&&completion.saved>=0&&completion.saved<=72,'invalid_receipt');
  requireCheck(Array.isArray(r.evidence)&&r.evidence.length===72,'evidence_mismatch');
  const histories=record(d.histories);requireCheck(Object.keys(histories).sort().join(',')===[...DAILY_SYMBOLS].sort().join(','),'scope_mismatch');
  const identities=new Set<string>();const summaries=[];
  for(const symbol of DAILY_SYMBOLS){
   const h=record(histories[symbol]);requireCheck(h.symbol===symbol&&h.source==='Alpaca:iex'&&!Object.hasOwn(h,'error'),'history_invalid');
   requireCheck(isDeepStrictEqual(h.missing,{})&&Object.keys(h).every(key=>['symbol','source','bars','inputSha256','missing','retrievedAt','inputSerializationVersion'].includes(key)),'history_invalid');
   requireCheck(timestamp(h.retrievedAt)>=started&&timestamp(h.retrievedAt)<=finished,'chronology_mismatch');
   const bars=restoreLegacyDailyInput(h.bars,h.inputSerializationVersion);
   const replay=dailySymbolEvidence(symbol,{source:h.source,bars},plan);
   requireCheck(replay.evidence.length===24&&'inputSha256' in replay.provenance&&replay.provenance.inputSha256===h.inputSha256,'input_hash_mismatch');
   for(const expected of replay.evidence){
    const matches=r.evidence.filter((x:unknown)=>{const row=record(x);return row.subject===symbol&&row.factor_key===expected.factor;});
    requireCheck(matches.length===1,'evidence_mismatch');const row=matches[0],metadata=record(row.source_metadata),intake=record(metadata.evidenceIntake);
    const {evidenceIntake,...rest}=metadata;
    requireCheck(Object.keys(intake).sort().join(',')==='availableAt,observedAt,persistenceTimePolicy,policyVersion','evidence_mismatch');
    requireCheck(row.value===expected.value&&row.domain===expected.domain&&row.source_name===expected.source&&isDeepStrictEqual(rest,expected.metadata),'evidence_mismatch');
    requireCheck(timestamp(row.observed_at)===timestamp(expected.observedAt)&&timestamp(row.available_at)===finished&&timestamp(intake.observedAt)===timestamp(expected.observedAt)&&timestamp(intake.availableAt)===finished,'chronology_mismatch');
    requireCheck(intake.policyVersion==='tradeos.evidence-intake.v2'&&intake.persistenceTimePolicy==='tradeos.evidence-persistence.microseconds.v1','evidence_mismatch');
    identities.add(symbol+':'+expected.factor);
   }
   summaries.push({symbol,factors:24,inputBars:200,inputSha256:h.inputSha256,serializationVersion:LEGACY_DAILY_INPUT_SERIALIZATION});
  }
  requireCheck(identities.size===DAILY_SYMBOLS.length*DAILY_KEYS.length,'evidence_mismatch');
  return {...assurance,status:'PASS' as const,session:plan.session,newlySaved:completion.saved,verifiedIdentities:identities.size,availableAt:d.finishedAt,symbols:summaries};
 }catch(error){
  const message=error instanceof Error?error.message:'';
  return {...assurance,status:'FAIL' as const,reason:failures.has(message as Failure)?message as Failure:'invalid_receipt' as Failure};
 }
}
