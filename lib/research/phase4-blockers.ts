export type Phase4ScientificStatusInput={
 pairedSamples:number;sessionDates:number;pairedLowerBound:number|null;
 independentlyVerifiedSourceTimes:number;immutableRecords:number;
 costAdjustedReturnLowerBound:number|null;executionSlippageValidated:boolean;
 portfolioReconciled:boolean;publicationTimeApplicable:boolean;publicationTimeVerified:number;
};

export function phase4ScientificBlockers(i:Phase4ScientificStatusInput){
 const blockers:{id:string;requiresUserAction:boolean;detail:string}[]=[];
 if(i.immutableRecords===0||i.independentlyVerifiedSourceTimes!==i.immutableRecords)blockers.push({
  id:"independent_source_time_certification",requiresUserAction:false,
  detail:"Stored provider event/receipt chronology is verified structurally, but the source timestamps have not been independently certified as exchange-authoritative."
 });
 if(i.publicationTimeApplicable&&i.publicationTimeVerified!==i.immutableRecords)blockers.push({
  id:"publication_time_certification",requiresUserAction:false,
  detail:"Every publication-derived input must prove public availability before the original decision."
 });
 if(i.pairedSamples<200)blockers.push({
  id:"prospective_pair_sample_floor",requiresUserAction:false,
  detail:String(i.pairedSamples)+"/200 matched prospective baseline/challenger outcomes have matured."
 });
 if(i.sessionDates<20)blockers.push({
  id:"independent_session_floor",requiresUserAction:false,
  detail:String(i.sessionDates)+"/20 independent market sessions have matured; elapsed market time cannot be backfilled honestly."
 });
 if(i.pairedLowerBound===null||!(i.pairedLowerBound>0))blockers.push({
  id:"positive_paired_skill_lower_bound",requiresUserAction:false,
  detail:"The session-clustered 95% lower confidence bound on challenger Brier improvement is not yet proven positive."
 });
 if(i.costAdjustedReturnLowerBound===null||!(i.costAdjustedReturnLowerBound>0)||!i.executionSlippageValidated)blockers.push({
  id:"cost_and_slippage_validation",requiresUserAction:false,
  detail:"Positive performance after independently validated spreads, slippage, fees and execution assumptions has not been established."
 });
 if(!i.portfolioReconciled)blockers.push({
  id:"portfolio_reconciliation",requiresUserAction:true,
  detail:"Full account/portfolio cash, positions, orders and fills reconciliation requires an explicitly authorized brokerage/account context."
 });
 return {scientificallyMature:blockers.length===0,blockers,modelPromotionAllowed:false,liveExecutionAllowed:false};
}
