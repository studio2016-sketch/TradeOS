export type EvidenceMetrics={
 total:number;immutableRecords:number;sourceTimeVerified:number;publicationTimeVerified:number;
 outOfSamplePaired:number;independentSessionDates:number;
 predictiveSkillLowerBound:number|null;costAdjustedReturnLowerBound:number|null;
 portfolioReconciled:boolean;executionSlippageValidated:boolean;
};
export type CertificationStatus="BLOCKED"|"RESEARCH_ONLY"|"INDEPENDENTLY_VALIDATED";
export function certifyResearch(e:EvidenceMetrics){
 const checks=[
  {id:"immutable_point_in_time",pass:e.immutableRecords>=200&&e.immutableRecords===e.total&&e.sourceTimeVerified===e.total,detail:"At least 200 immutable forecasts with independently verified source timestamps"},
  {id:"publication_time",pass:e.total>0&&e.publicationTimeVerified===e.total,detail:"Publication times precede each original decision"},
  {id:"untouched_chronological_holdout",pass:e.outOfSamplePaired>=200&&e.independentSessionDates>=20,detail:"At least 200 truly prospective paired predictions across 20 sessions"},
  {id:"predictive_skill",pass:e.predictiveSkillLowerBound!==null&&e.predictiveSkillLowerBound>0,detail:"Positive lower confidence bound on paired forecast improvement"},
  {id:"execution_costs",pass:e.costAdjustedReturnLowerBound!==null&&e.costAdjustedReturnLowerBound>0&&e.executionSlippageValidated,detail:"Positive lower confidence bound after verified execution costs"},
  {id:"broker_reconciliation",pass:e.portfolioReconciled,detail:"Account inception-to-date cash, positions, orders and fills reconciled"}
 ];
 const failures=checks.filter(x=>!x.pass);
 return {status:"BLOCKED" as CertificationStatus,certified:false,modelPromotionAllowed:false,liveExecutionAllowed:false,
  checks,failedChecks:failures.map(x=>x.id),
  note:failures.length?"Certification blocked until independent evidence is supplied. No numerical score substitutes for a missing gate.":"Automated prerequisites pass; independent sign-off remains required before certification."};
}
