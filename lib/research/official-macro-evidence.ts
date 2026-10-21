import {latestRegimeContext} from "../market/fred";
import {auditEvidence,type Evidence} from "./source-vintage-audit";
const mapping:Record<string,string>={DGS10:"us10y_yield",DGS2:"us2y_yield",T10Y2Y:"yield_curve_slope",DFF:"fed_policy_rate",BAMLH0A0HYM2:"high_yield_spread",DCOILWTICO:"wti_crude",DTWEXBGS:"dxy"};
export async function observedMacroEvidence(now=new Date()){
 const requestedAt=now.toISOString();
 const context=await latestRegimeContext();
 const receivedAt=new Date().toISOString();
 const evidence:Evidence[]=[];
 const excluded:string[]=[];
 for(const diagnostic of context.diagnostics){
  const factor=mapping[diagnostic.series];
  const point=diagnostic.point;
  if(!factor||diagnostic.status!=="ok"||!point||!Number.isFinite(point.value)){excluded.push(diagnostic.series);continue;}
  const observedAt=point.date+"T00:00:00Z";
  if(!Number.isFinite(Date.parse(observedAt))||Date.parse(observedAt)>Date.parse(requestedAt)){excluded.push(diagnostic.series);continue;}
  // FRED observation dates are NOT original public release timestamps.
  // Only claim availability at actual retrieval, never retroactively.
  evidence.push({factor,value:point.value as number,domain:"macro",source:"FRED:"+diagnostic.series,subject:"US_MACRO",observedAt,availableAt:receivedAt});
 }
 const audit=auditEvidence(evidence,receivedAt);
 return {retrievedAt:receivedAt,measured:audit.measured,factors:evidence,excluded,backtestEligible:false,warning:"FRED current-vintage observations: retrieval proves present availability, not historical release availability or independent data vintage."};
}
