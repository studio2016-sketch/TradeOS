export type EvidenceMetrics={
 total:number;immutableRecords:number;sourceTimeVerified:number;publicationTimeApplicable:boolean;publicationTimeVerified:number;
 outOfSamplePaired:number;independentSessionDates:number;
 predictiveSkillLowerBound:number|null;costAdjustedReturnLowerBound:number|null;
 portfolioReconciled:boolean;executionSlippageValidated:boolean;
 prospectiveOutcomeRecords:number;prospectiveOutcomeSessions:number;fingerprintedOutcomeRecords:number;
 prospectiveOutcomePasses:number;prospectiveOutcomeFailures:number;
};
export type CertificationStatus="BLOCKED"|"RESEARCH_ONLY"|"INDEPENDENTLY_VALIDATED";
export function certifyResearch(e:EvidenceMetrics){
 const checks=[
  {id:"immutable_point_in_time",pass:e.immutableRecords>=200&&e.immutableRecords===e.total&&e.sourceTimeVerified===e.total,detail:"At least 200 immutable forecasts with source-time-certified timestamps"},
  {id:"publication_time",pass:!e.publicationTimeApplicable||(e.total>0&&e.publicationTimeVerified===e.total),detail:e.publicationTimeApplicable?"Publication-derived inputs were publicly available before each original decision":"Not applicable: current prospective trial uses stored market observations rather than publication-derived inputs"},
  {id:"untouched_chronological_holdout",pass:e.outOfSamplePaired>=200&&e.independentSessionDates>=20,detail:"At least 200 truly prospective paired predictions across 20 sessions"},
  {id:"frozen_prediction_outcomes",pass:e.prospectiveOutcomeRecords>=200&&e.prospectiveOutcomeSessions>=20&&e.fingerprintedOutcomeRecords===e.prospectiveOutcomeRecords&&e.prospectiveOutcomePasses+e.prospectiveOutcomeFailures===e.prospectiveOutcomeRecords,detail:"At least 200 prospective PASS/FAIL outcomes across 20 sessions, all bound to the frozen protocol fingerprint"},
  {id:"predictive_skill",pass:e.predictiveSkillLowerBound!==null&&e.predictiveSkillLowerBound>0,detail:"Positive lower confidence bound on paired forecast improvement"},
  {id:"execution_costs",pass:e.costAdjustedReturnLowerBound!==null&&e.costAdjustedReturnLowerBound>0&&e.executionSlippageValidated,detail:"Positive lower confidence bound after verified execution costs"},
  {id:"broker_reconciliation",pass:e.portfolioReconciled,detail:"Account inception-to-date cash, positions, orders and fills reconciled"}
 ];
 const failures=checks.filter(x=>!x.pass);
 const certified=failures.length===0;
 return {status:(certified?"INDEPENDENTLY_VALIDATED":"BLOCKED") as CertificationStatus,certified,modelPromotionAllowed:certified,liveExecutionAllowed:false,
  checks,failedChecks:failures.map(x=>x.id),
  note:failures.length?"Certification blocked until objective prospective evidence satisfies every gate. No numerical score substitutes for a missing gate.":"Objective prospective market outcomes, point-in-time lineage, paired skill, verified costs, and brokerage reconciliation satisfy the empirical certification gates. Live execution remains a separate human-controlled authorization."};
}
