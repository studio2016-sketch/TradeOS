export const PHASE3_MEASURED_FACTOR_TARGET=101;

export function phase3CompletionGate(input:{
 measuredFactorCount:number;
 invalidEvidenceVintages:number;
 requiredCollectorFailures:number;
}){
 const measured=Number(input.measuredFactorCount);
 const invalid=Number(input.invalidEvidenceVintages);
 const failures=Number(input.requiredCollectorFailures);
 if(!Number.isInteger(measured)||measured<0||measured>120)throw new Error("Invalid measured factor count");
 if(!Number.isInteger(invalid)||invalid<0)throw new Error("Invalid vintage violation count");
 if(!Number.isInteger(failures)||failures<0)throw new Error("Invalid collector failure count");
 const blockers:string[]=[];
 if(measured<PHASE3_MEASURED_FACTOR_TARGET)blockers.push("MEASURED_FACTOR_TARGET_NOT_REACHED");
 if(invalid>0)blockers.push("INVALID_EVIDENCE_VINTAGES");
 if(failures>0)blockers.push("RECENT_REQUIRED_COLLECTOR_FAILURES");
 return {
  phase:"3",
  measuredFactorCount:measured,
  target:PHASE3_MEASURED_FACTOR_TARGET,
  targetPct:Math.round(PHASE3_MEASURED_FACTOR_TARGET/120*1000)/10,
  passed:blockers.length===0,
  blockers,
  approvedForTrading:false,
  certifiedPredictiveFactors:0
 };
}
