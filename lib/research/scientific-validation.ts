export type ValidationState="PASS"|"PRELIMINARY"|"BLOCKED";

export type ScientificValidationInput={
 forecastTotal:number;
 labelledForecasts:number;
 forecastSessionDates:number;
 immutableRecords:number;
 timeOrderedImmutableRecords:number;
 futureDatedImmutableRecords:number;
 independentlyTimestampVerified:number;
 publicationTimeVerified:number;
 accelerationRecords:number;
 accelerationSessionDates:number;
 replayTrials:number;
 replayCostLevels:number;
 prospectivePairs:number;
 prospectiveSessionDates:number;
 prospectiveIntervalLow:number|null;
 executionSlippageValidated:boolean;
 brokerReconciled:boolean;
 independentReplayVerified:boolean;
 registeredHypothesisFamily:boolean;
};

export type ValidationGate={
 id:string;
 label:string;
 state:ValidationState;
 observed:string;
 requirement:string;
 implication:string;
};

const finiteNonNegative=(x:number)=>Number.isFinite(x)&&x>=0;

export function assessScientificValidation(input:ScientificValidationInput){
 const numeric=[input.forecastTotal,input.labelledForecasts,input.forecastSessionDates,input.immutableRecords,
  input.timeOrderedImmutableRecords,input.futureDatedImmutableRecords,input.independentlyTimestampVerified,
  input.publicationTimeVerified,input.accelerationRecords,input.accelerationSessionDates,input.replayTrials,
  input.replayCostLevels,input.prospectivePairs,input.prospectiveSessionDates];
 if(numeric.some(x=>!finiteNonNegative(x)))throw Error("Invalid validation evidence");
 const temporalPass=input.immutableRecords>=200&&input.timeOrderedImmutableRecords===input.immutableRecords&&input.futureDatedImmutableRecords===0;
 const independentTimePass=input.immutableRecords>=200&&input.independentlyTimestampVerified===input.immutableRecords&&input.publicationTimeVerified===input.immutableRecords;
 const outcomePass=input.labelledForecasts>=200&&input.forecastSessionDates>=20;
 const prospectiveDepth=input.prospectivePairs>=200&&input.prospectiveSessionDates>=20;
 const prospectiveSkill=prospectiveDepth&&input.prospectiveIntervalLow!==null&&Number.isFinite(input.prospectiveIntervalLow)&&input.prospectiveIntervalLow>0;
 const replayPass=input.replayTrials>0&&input.replayCostLevels>=3;
 const gates:ValidationGate[]=[
  {id:"immutable_temporal_ordering",label:"Immutable temporal ordering",state:temporalPass?"PASS":"BLOCKED",observed:`${input.timeOrderedImmutableRecords}/${input.immutableRecords} ordered; ${input.futureDatedImmutableRecords} future-dated`,requirement:"At least 200 immutable records; every observation time at or before record time",implication:"Checks internal ordering only; it does not prove the provider published the value at that time."},
  {id:"independent_source_timing",label:"Independent source timing",state:independentTimePass?"PASS":"BLOCKED",observed:`${input.independentlyTimestampVerified} source-time and ${input.publicationTimeVerified} publication-time verified`,requirement:"Independent source and publication timestamps for every candidate record",implication:"Blocks point-in-time certification and guards against revised or backfilled data."},
  {id:"outcome_depth",label:"Resolved outcome depth",state:outcomePass?"PASS":input.labelledForecasts>=200?"PRELIMINARY":"BLOCKED",observed:`${input.labelledForecasts}/${input.forecastTotal} labelled across ${input.forecastSessionDates} sessions`,requirement:"At least 200 labels across 20 independent sessions",implication:"A large row count across few dates is not an independent sample."},
  {id:"prospective_depth",label:"Frozen prospective comparison",state:prospectiveDepth?"PASS":input.prospectivePairs>0?"PRELIMINARY":"BLOCKED",observed:`${input.prospectivePairs} paired outcomes across ${input.prospectiveSessionDates} sessions`,requirement:"At least 200 paired outcomes across 20 sessions",implication:"Champion and challenger must remain frozen while future outcomes mature."},
  {id:"prospective_skill",label:"Prospective predictive skill",state:prospectiveSkill?"PASS":prospectiveDepth?"PRELIMINARY":"BLOCKED",observed:input.prospectiveIntervalLow===null?"No eligible clustered confidence interval":`Clustered 95% lower bound ${input.prospectiveIntervalLow.toFixed(6)}`,requirement:"Positive clustered 95% lower bound after the depth gate",implication:"Factor availability and in-sample fit cannot satisfy this gate."},
  {id:"multiple_testing",label:"Multiple-testing control",state:input.registeredHypothesisFamily?"PRELIMINARY":"BLOCKED",observed:input.registeredHypothesisFamily?"Hypothesis family registered; adjusted prospective result pending":"No complete registered hypothesis family linked to outcomes",requirement:"Pre-register the tested family and apply Holm correction to all reported hypotheses",implication:"Prevents selecting only favorable factors from the 120-factor catalog."},
  {id:"cost_sensitivity",label:"Cost sensitivity",state:replayPass?"PRELIMINARY":"BLOCKED",observed:`${input.replayTrials} replay rows across ${input.replayCostLevels} cost levels`,requirement:"Replay across at least three cost levels, then validate realized slippage",implication:"Replay costs are useful stress tests but are not observed execution costs."},
  {id:"execution_slippage",label:"Observed execution slippage",state:input.executionSlippageValidated?"PASS":"BLOCKED",observed:input.executionSlippageValidated?"Independently validated":"Not independently validated",requirement:"Reconcile modeled fills against broker fills and market quotes",implication:"Required before any profitability or execution claim."},
  {id:"independent_replay",label:"Independent replay",state:input.independentReplayVerified?"PASS":"BLOCKED",observed:input.independentReplayVerified?"Verified by an independent implementation":"Not independently verified",requirement:"A separately implemented point-in-time replay must reproduce the result",implication:"Reduces shared-code and implementation-error risk."},
  {id:"broker_reconciliation",label:"Broker reconciliation",state:input.brokerReconciled?"PASS":"BLOCKED",observed:input.brokerReconciled?"Reconciled":"Outstanding",requirement:"Cash, positions, orders and fills reconciled inception-to-date",implication:"No live-execution certification without an independently reconciled ledger."}
 ];
 const counts=gates.reduce((a,g)=>({...a,[g.state]:a[g.state]+1}),{PASS:0,PRELIMINARY:0,BLOCKED:0});
 return{
  status:"RESEARCH_ONLY" as const,
  predictiveCertification:"BLOCKED" as const,
  approvedModelInfluence:false,
  liveExecutionAllowed:false,
  counts,
  gates,
  evidenceLayers:{
   engineering:"VERIFIED_BY_AUTOMATED_TESTS",
   measurement:"OBSERVED_WITH_PROVENANCE",
   statisticalValidation:prospectiveDepth?"IN_PROGRESS":"INSUFFICIENT_INDEPENDENT_SESSIONS",
   independentCertification:"NOT_ESTABLISHED"
  },
  nextMilestone:input.prospectivePairs<200?`${200-input.prospectivePairs} additional valid paired outcomes plus session depth`:
   input.prospectiveSessionDates<20?`${20-input.prospectiveSessionDates} additional independent sessions`:
   "Independent timing, replay, slippage and brokerage verification"
 };
}
