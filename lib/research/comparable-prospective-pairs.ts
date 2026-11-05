import {horizonMs} from "../market/horizon";
import {PREDICTION_OUTCOME_PROTOCOL as protocol,PREDICTION_OUTCOME_PROTOCOL_ACTIVATION as activation,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT as fingerprint,PREDICTION_OUTCOME_RULE_VERSION as version} from "./prediction-outcome-verdict";
import type {PairedForecast} from "./prospectiveTrial";
const object=(v:unknown):Record<string,any>|null=>{try{const x=typeof v==="string"?JSON.parse(v):v;return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,any>:null;}catch{return null;}};
const number=(v:unknown)=>typeof v==="number"?Number.isFinite(v)?v:null:typeof v==="string"&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v.trim())&&Number.isFinite(Number(v))?Number(v):null;
const time=(v:unknown)=>v instanceof Date?v.getTime():typeof v==="string"?Date.parse(v):NaN;
const id=(v:unknown)=>typeof v==="string"&&/^[1-9]\d*$/.test(v)?v:typeof v==="number"&&Number.isSafeInteger(v)&&v>0?String(v):null;

/** Outcome comparability only. Protocol labels do not certify source timing.
 * Historical reconstructions are returned separately and must never contribute
 * to prospective sample counts, confidence intervals or scientific gates.
 */
type PairSelection={prospectivePairs:PairedForecast[];reconstructedPairs:PairedForecast[];outcomeDisagreements:number|null;diagnostics:{candidateRows:number;candidateSetComplete:boolean;prospectivePairs:number;historicalReconstructionPairs:number;excludedRows:number;exclusions:Record<string,number>;sourceTimeCertified:false;independentlyCertified:false}};
export function selectComparableProspectivePairs(rows:Record<string,any>[]):PairSelection{
 const prospectivePairs:PairedForecast[]=[],reconstructedPairs:PairedForecast[]=[];
 // API queries request one sentinel beyond this cap. Never infer uniqueness or
 // prospective evidence from a truncated candidate cohort.
 if(rows.length>10000)return {prospectivePairs,reconstructedPairs,outcomeDisagreements:null,diagnostics:{candidateRows:rows.length,candidateSetComplete:false,prospectivePairs:0,historicalReconstructionPairs:0,excludedRows:rows.length,exclusions:{CANDIDATE_LIMIT_EXCEEDED:rows.length},sourceTimeCertified:false,independentlyCertified:false}};
 const exclusions:Record<string,number>={},forecastIds=new Map<string,number>();
 for(const row of rows){for(const key of ["baseline_id","challenger_id"]){const keyId=id(row[key]);if(keyId)forecastIds.set(keyId,(forecastIds.get(keyId)??0)+1);}}
 let outcomeDisagreements=0;
 const reject=(reason:string)=>{exclusions[reason]=(exclusions[reason]??0)+1;};
 for(const r of rows){
  const bId=id(r.baseline_id),cId=id(r.challenger_id);
  if(typeof r.baseline_outcome==="boolean"&&typeof r.challenger_outcome==="boolean"&&r.baseline_outcome!==r.challenger_outcome)outcomeDisagreements++;
  if(!bId||!cId||bId===cId){reject("INVALID_PAIR_IDENTIFIERS");continue;}
  if(forecastIds.get(bId)!==1||forecastIds.get(cId)!==1){reject("AMBIGUOUS_REUSED_FORECAST");continue;}
  const duration=horizonMs(String(r.baseline_horizon??""));
  if(typeof r.symbol!=="string"||!r.symbol||!Number.isFinite(duration)||!duration||duration<=0||duration!==horizonMs(String(r.challenger_horizon??""))||r.baseline_direction!==r.challenger_direction||!["bullish","bearish"].includes(r.baseline_direction)){reject("DIFFERENT_PREDICTION_TARGET");continue;}
  const b=object(r.baseline_notes),c=object(r.challenger_notes);
  if(!b||!c){reject("MISSING_STRUCTURED_OUTCOME_PROVENANCE");continue;}
  const bound=(n:Record<string,any>,snapshot:unknown)=>{const p=object(snapshot)?.outcomeProtocol;return n.evidenceClass===undefined&&n.ruleVersion===version&&n.protocolFingerprint===fingerprint&&n.protocolActivation===activation&&p?.ruleVersion===version&&p?.protocolFingerprint===fingerprint&&p?.activation===activation;};
  const prospective=bound(b,r.baseline_snapshot)&&bound(c,r.challenger_snapshot);
  const historical=[b,c].every(n=>n.evidenceClass==="HISTORICAL_RECONSTRUCTION"&&n.ruleVersion===undefined&&n.protocolFingerprint===undefined&&n.protocolActivation===undefined);
  if(!prospective&&!historical){reject("UNMATCHED_OUTCOME_PROTOCOL");continue;}
  const bs=time(b.startObservationTime),cs=time(c.startObservationTime),be=time(b.evaluationObservationTime),ce=time(c.evaluationObservationTime);
  if(typeof b.sourceId!=="string"||!b.sourceId.trim()||b.sourceId!==c.sourceId||![bs,cs,be,ce].every(Number.isFinite)||bs!==cs||be!==ce){reject("DIFFERENT_OR_MISSING_OUTCOME_OBSERVATIONS");continue;}
  const bc=time(r.baseline_created_at),cc=time(r.challenger_created_at);
  if(![bc,cc].every(Number.isFinite)||[bc,cc].some(t=>bs>t||t-bs>protocol.predictionQuoteMaxAgeMs||be<t+duration||be>t+duration+protocol.evaluationGraceMs)||be<=bs||(prospective&&Math.min(bc,cc)<Date.parse(activation))){reject("OUTCOME_WINDOW_OUTSIDE_FROZEN_POLICY");continue;}
  const br=number(r.baseline_return),cr=number(r.challenger_return),cost=number(b.quotedRoundTripCost),otherCost=number(c.quotedRoundTripCost),edge=number(b.minimumNetEdge),otherEdge=number(c.minimumNetEdge);
  if(br===null||cr===null||cost===null||otherCost===null||edge===null||otherEdge===null||cost<0||edge<0||br!==cr||cost!==otherCost||edge!==otherEdge||(prospective&&edge!==protocol.minimumNetEdge)){reject("DIFFERENT_OR_INVALID_OUTCOME_VALUES");continue;}
  // Exact stored precision is conservative: borderline rounded results fail
  // rather than reassigning either immutable outcome.
  const pass=(r.baseline_direction==="bearish"?-br:br)-cost>=edge;
  if(typeof r.baseline_outcome!=="boolean"||typeof r.challenger_outcome!=="boolean"||r.baseline_outcome!==pass||r.challenger_outcome!==pass||b.outcomeDisposition!==(pass?"PASS":"FAIL")||c.outcomeDisposition!==(pass?"PASS":"FAIL")){reject("OUTCOME_LABEL_NOT_REPRODUCIBLE");continue;}
  const baselineP=number(r.baseline_probability),challengerP=number(r.challenger_probability),observed=time(r.observed_at);
  if(baselineP===null||challengerP===null||[baselineP,challengerP].some(p=>p<0||p>1)||!Number.isFinite(observed)||observed>Math.min(bc,cc)){reject("INVALID_FORECAST_VALUES");continue;}
  const pair={timestamp:new Date(observed).toISOString(),symbol:r.symbol,baselineP,challengerP,outcome:(pass?1:0) as 0|1};
  (prospective?prospectivePairs:reconstructedPairs).push(pair);
 }
 return {prospectivePairs,reconstructedPairs,outcomeDisagreements,diagnostics:{candidateRows:rows.length,candidateSetComplete:true,prospectivePairs:prospectivePairs.length,historicalReconstructionPairs:reconstructedPairs.length,excludedRows:Object.values(exclusions).reduce((a,b)=>a+b,0),exclusions,sourceTimeCertified:false,independentlyCertified:false}};
}
