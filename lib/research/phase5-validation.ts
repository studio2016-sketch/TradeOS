export type Phase5InfrastructureInput={
 phase4Passed:boolean;
 certificationForecasts:number;
 immutableCleanRecords:number;
 strictCleanVerified:number;
 executionSnapshots:number;
 executionImplementation:string;
 brokerImplementation:string;
 sourceCertificationLedgerReady:boolean;
 fillSlippageLedgerReady:boolean;
 portfolioReconciliationLedgerReady:boolean;
 appendOnlyProtectedTables:number;
 certificationFailClosed:boolean;
};

export function phase5InfrastructureGate(i:Phase5InfrastructureInput){
 const checks=[
  {id:"phase4_foundation",pass:i.phase4Passed,detail:"Latest Phase 4 validation infrastructure snapshot passes"},
  {id:"clean_epoch_immutable_capture",pass:i.certificationForecasts>=2&&i.immutableCleanRecords===i.certificationForecasts&&i.strictCleanVerified===i.certificationForecasts,detail:"Clean certification epoch has live baseline/challenger forecasts and every forecast is immutable with strict pre-forecast source verification"},
  {id:"execution_realism_snapshot",pass:i.executionSnapshots>0,detail:"At least one persisted spread-adjusted execution-realism snapshot exists"},
  {id:"execution_validator_version",pass:i.executionImplementation==="quoted-spread-and-fill-slippage-v1",detail:"Quoted-spread and empirical fill-slippage validators are installed"},
  {id:"broker_reconciliation_version",pass:i.brokerImplementation==="paginated-read-only-v2",detail:"Protected brokerage reconciliation paginates orders plus trade and non-trade activities"},
  {id:"source_certification_ledger",pass:i.sourceCertificationLedgerReady,detail:"Append-only independent source-time certification ledger exists"},
  {id:"fill_slippage_ledger",pass:i.fillSlippageLedgerReady,detail:"Append-only empirical fill-slippage validation ledger exists"},
  {id:"portfolio_reconciliation_ledger",pass:i.portfolioReconciliationLedgerReady,detail:"Append-only aggregate portfolio reconciliation validation ledger exists"},
  {id:"append_only_protections",pass:i.appendOnlyProtectedTables>=11,detail:"Phase 4/5 forecast, evidence, attestation, execution and certification ledgers reject update/delete mutation"},
  {id:"certification_fail_closed",pass:i.certificationFailClosed,detail:"Missing scientific evidence cannot authorize model promotion or live execution"}
 ];
 const blockers=checks.filter(x=>!x.pass).map(x=>x.id);
 return {phase:"5",scope:"certification_and_execution_infrastructure",passed:blockers.length===0,checks,blockers,
  scientificCertificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false};
}

export type Phase5ScientificInput={
 immutableRecords:number;
 independentlyCertifiedSourceTimes:number;
 pairedSamples:number;
 independentSessions:number;
 pairedSkillLowerBound:number|null;
 modeledCostLowerBound:number|null;
 modeledCostMature:boolean;
 empiricalSlippageValidated:boolean;
 portfolioReconciled:boolean;
};

export function phase5ScientificStatus(i:Phase5ScientificInput){
 const blockers:{id:string;requiresUserAction:boolean;detail:string}[]=[];
 if(i.immutableRecords===0||i.independentlyCertifiedSourceTimes!==i.immutableRecords)blockers.push({id:"independent_source_time_certification",requiresUserAction:false,detail:String(i.independentlyCertifiedSourceTimes)+"/"+String(i.immutableRecords)+" prospective decisions have independently certified source timestamps."});
 if(i.pairedSamples<200)blockers.push({id:"prospective_pair_sample_floor",requiresUserAction:false,detail:String(i.pairedSamples)+"/200 matched prospective outcomes have matured."});
 if(i.independentSessions<20)blockers.push({id:"independent_session_floor",requiresUserAction:false,detail:String(i.independentSessions)+"/20 independent market sessions have matured."});
 if(i.pairedSkillLowerBound===null||i.pairedSkillLowerBound<=0)blockers.push({id:"positive_paired_skill_lower_bound",requiresUserAction:false,detail:"Paired forecast improvement does not yet have a positive lower confidence bound."});
 if(!i.modeledCostMature||i.modeledCostLowerBound===null||i.modeledCostLowerBound<=0)blockers.push({id:"spread_adjusted_cost_maturity",requiresUserAction:false,detail:"Quoted-spread-adjusted prospective returns have not yet matured across the required sessions with a positive lower bound."});
 if(!i.empiricalSlippageValidated)blockers.push({id:"empirical_fill_slippage",requiresUserAction:true,detail:"Actual fill-versus-pre-fill-quote slippage is not independently validated from an authorized brokerage history."});
 if(!i.portfolioReconciled)blockers.push({id:"portfolio_reconciliation",requiresUserAction:true,detail:"Full brokerage cash, positions, orders, fills and non-trade activity reconciliation is not certified."});
 return {scientificallyMature:blockers.length===0,blockers,modelPromotionAllowed:false,liveExecutionAllowed:false};
}
