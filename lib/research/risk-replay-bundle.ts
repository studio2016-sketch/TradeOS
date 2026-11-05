import {createHash} from "node:crypto";
import {synchronizedRiskStatistics} from "./synchronized-risk-statistics";

type Window={own:{t:string;c:number}[];benchmark:{t:string;c:number}[]};
type Row={factor:string;subject:string;source:string;value:number;observedAt:string;availableAt:string};
export const RISK_IMPLEMENTATION_SHA256="558ee725ce0eb2616a62f15772b8fcef4b632a21e74305ee31d95647c2d49fc1";
const implementationPath="lib/research/synchronized-risk-statistics.ts";
const supported=(factor:string)=>factor==="beta"?{sessions:60,metric:"beta" as const}:factor==="rolling_correlation"||factor==="equity_bond_correlation"?{sessions:20,metric:"correlation" as const}:null;

// Sorted keys survive PostgreSQL JSONB key reordering. No rounding or coercion.
function canonical(value:unknown):string{
 if(value===null||typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
 if(typeof value==="number"&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
 if(value&&typeof value==="object"&&Object.getPrototypeOf(value)===Object.prototype)return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(",")}}`;
 throw Error("Non-JSON replay input");
}
const digest=(value:unknown)=>createHash("sha256").update(canonical(value)).digest("hex");

/** Captures reproducible arithmetic inputs, NOT source-time or predictive certification. */
export function createRiskReplayBundle(row:Row,inputWindow:Window,identity:{ownSymbol:string;benchmarkSymbol:string;feed:string}){
 const spec=supported(row.factor);
 if(!spec)throw Error("Unsupported replay factor");
 const payload={schema:"tradeos-risk-replay-v1",implementation:{path:implementationPath,sha256:RISK_IMPLEMENTATION_SHA256},
  row:{...row},identity:{...identity},inputPolicy:{timeframe:"1Day",adjustment:"all",window:"last_exact_common_dates",sessions:spec.sessions},
  metric:spec.metric,inputWindow};
 // Copy through canonical JSON so callers cannot mutate the captured input arrays.
 const snapshot=JSON.parse(canonical(payload));
 return {payload:snapshot,sha256:digest(snapshot)};
}

/** Recompute using the pinned implementation. This is same-code reproduction,
 * not an independent implementation, source authentication or certification.
 * Supply the outer stored row to reject a bundle detached from its row.
 */
export function checkRiskReplayBundle(bundle:unknown,row:Row){
 const fail=(reason:string)=>({status:"UNVERIFIED" as const,reason,certified:false as const});
 try{
  const b=bundle as ReturnType<typeof createRiskReplayBundle>,p=b?.payload;
  if(!p||typeof b.sha256!=="string"||digest(p)!==b.sha256)return fail("MISSING_OR_CORRUPT_BUNDLE");
  if(p.schema!=="tradeos-risk-replay-v1"||p.implementation?.path!==implementationPath||p.implementation?.sha256!==RISK_IMPLEMENTATION_SHA256)return fail("UNKNOWN_IMPLEMENTATION");
  const spec=supported(row.factor);
  if(!spec||p.metric!==spec.metric||p.inputPolicy?.sessions!==spec.sessions||p.inputPolicy?.timeframe!=="1Day"||p.inputPolicy?.adjustment!=="all"||p.inputPolicy?.window!=="last_exact_common_dates")return fail("UNSUPPORTED_INPUT_POLICY");
  if(canonical(p.row)!==canonical(row))return fail("ROW_MISMATCH");
  const expectedOwn=row.factor==="equity_bond_correlation"?"SPY":row.subject;
  const expectedBenchmark=row.factor==="equity_bond_correlation"?"TLT":"SPY";
  if(p.identity?.ownSymbol!==expectedOwn||p.identity?.benchmarkSymbol!==expectedBenchmark||typeof p.identity?.feed!=="string"||!p.identity.feed||row.source!==`Alpaca:${p.identity.feed}:1Day`||row.factor==="equity_bond_correlation"&&row.subject!=="SPY_TLT")return fail("SOURCE_IDENTITY_MISMATCH");
  if(!Number.isFinite(Date.parse(row.availableAt))||Date.parse(row.availableAt)<Date.parse(row.observedAt))return fail("INVALID_RECEIPT_TIME");
  const w=p.inputWindow;
  if(!Array.isArray(w?.own)||!Array.isArray(w?.benchmark)||w.own.length!==spec.sessions+1||w.benchmark.length!==spec.sessions+1)return fail("INVALID_WINDOW");
  const result=synchronizedRiskStatistics(w.own,w.benchmark,spec.sessions);
  if(!result||result[spec.metric]===null||result[spec.metric]!==row.value||result.observedAt!==row.observedAt)return fail("RECOMPUTATION_MISMATCH");
  return {status:"REPRODUCED" as const,reason:"SAME_IMPLEMENTATION_ARITHMETIC_ONLY",certified:false as const};
 }catch{return fail("INVALID_BUNDLE");}
}
