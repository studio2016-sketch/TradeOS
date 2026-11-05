import {checkRiskReplayBundle} from "./risk-replay-bundle";
import {calculateReferenceRiskStatistics as referenceRiskStatistics} from "./reference-risk-statistics";

// Predeclared engineering tolerance for differing floating-point algorithms.
// This is not a statistical confidence bound or a predictive-skill test.
export const REFERENCE_TOLERANCE={absolute:1e-10,relative:1e-9};
export function referenceValuesAgree(a:number,b:number){
 return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=REFERENCE_TOLERANCE.absolute+REFERENCE_TOLERANCE.relative*Math.max(Math.abs(a),Math.abs(b));
}
const flags={sourceTimeCertified:false,independentReplayVerified:false,predictiveCertification:false,liveExecutionAllowed:false};
const iso=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;

/** Read-only cross-check of exported database rows. No database/provider access.
 * The reference arithmetic is separately authored, not an external certification.
 * Envelope validation still shares the production bundle checker.
 */
export function crossCheckCapturedRiskRow(input:unknown){
 const fail=(reason:string)=>({status:"UNVERIFIED" as const,reason,...flags});
 try{
  if(!input||typeof input!=="object")return fail("INVALID_EXPORTED_ROW");
  const x=input as Record<string,any>,observedAt=iso(x.observed_at),availableAt=iso(x.available_at);
  if(!observedAt||!availableAt||typeof x.factor_key!=="string"||typeof x.subject!=="string"||typeof x.source_name!=="string"||typeof x.value!=="number"||!Number.isFinite(x.value))return fail("INVALID_EXPORTED_ROW");
  const row={factor:x.factor_key,subject:x.subject,source:x.source_name,value:x.value,observedAt,availableAt};
  const bundle=x.source_metadata?.riskReplay;
  const envelope=checkRiskReplayBundle(bundle,row);
  if(envelope.status!=="REPRODUCED")return fail(envelope.reason);
  const {inputWindow,inputPolicy,metric}=bundle.payload;
  let result:ReturnType<typeof referenceRiskStatistics>;
  try{result=referenceRiskStatistics(inputWindow.own,inputWindow.benchmark,inputPolicy.sessions);}
  catch{return fail("REFERENCE_INPUT_REJECTED");}
  const value=metric==="beta"?result.beta:result.correlation;
  if(value===null||result.observedAt!==observedAt||result.sampleCount!==inputPolicy.sessions)return fail("REFERENCE_RESULT_UNAVAILABLE");
  const difference=Math.abs(value-row.value);
  return {status:referenceValuesAgree(value,row.value)?"REFERENCE_AGREES" as const:"REFERENCE_DISAGREES" as const,
   factor:row.factor,subject:row.subject,storedValue:row.value,referenceValue:value,absoluteDifference:difference,
   tolerance:REFERENCE_TOLERANCE,reason:"SEPARATELY_AUTHORED_ARITHMETIC_SHARED_ENVELOPE_VALIDATION",...flags};
 }catch{return fail("INVALID_EXPORTED_ROW");}
}
