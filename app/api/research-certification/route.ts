import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {certifyResearch} from "../../../lib/research/certificationAuthority";
import {BASELINE_VERSION,CHALLENGER_VERSION,TRIAL_ACTIVATION,CERTIFICATION_ACTIVATION} from "../../../lib/research/frozenChallenger";
import {pairedProspectiveValidation} from "../../../lib/research/phase4-validation";
import {phase5ScientificStatus} from "../../../lib/research/phase5-validation";
export const dynamic="force-dynamic";

export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Research database disconnected"},{status:503});
 try{
  const sql=db();
  const [counts,pairs,executionRows,portfolioRows]=await Promise.all([
   sql`select
     (select count(*)::int from forecast_ledger where created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as total,
     (select count(*)::int from immutable_decision_records where recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as immutable_records,
     (select count(*)::int from immutable_decision_records where recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and observed_at<=recorded_at+interval '1 minute') as structural_point_in_time,
     (select count(*)::int from tradeos_decision_source_verifications v join immutable_decision_records i on i.id=v.immutable_decision_id where i.recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and i.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as strict_source_verified,
     (select count(*)::int from immutable_decision_records i join forecast_ledger f on f.id=i.forecast_id join tradeos_decision_source_verifications v on v.immutable_decision_id=i.id join source_observations so on so.id=v.source_observation_id where i.recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and i.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and exists(select 1 from tradeos_source_time_certifications c where c.certification_kind='exchange_authoritative_timestamp' and lower(c.provider)=lower(split_part(so.source_id,':',1)) and lower(c.feed)=lower(split_part(so.source_id,':',2)) and c.valid_from<=f.created_at and (c.valid_to is null or c.valid_to>f.created_at))) as source_time_verified,
     (select count(*)::int from immutable_decision_records where recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and source_type='primary_publication_time_verified') as publication_time_verified,
     (select count(*)::int from forecast_outcomes o join forecast_ledger f on f.id=o.forecast_id where f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and f.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and o.resolved_at<f.created_at) as invalid_outcome_chronology`,
   sql`with b as (
      select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,f.created_at,
        power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss
      from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
      where f.model_version=${BASELINE_VERSION} and f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and o.was_correct is not null
    ), c as (
      select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,
        power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss
      from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
      where f.model_version=${CHALLENGER_VERSION} and f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and o.was_correct is not null
    )
    select b.created_at as time,b.loss as baseline_loss,c.loss as challenger_loss
    from b join c using(symbol,horizon,bucket) order by b.created_at asc`,
   sql`select * from tradeos_execution_validation_snapshots where details->>'trialActivation'=${CERTIFICATION_ACTIVATION} order by created_at desc limit 1`,
   sql`select * from tradeos_portfolio_reconciliation_validations order by created_at desc limit 1`
  ]);
  const r=(counts as any[])[0];
  const paired=pairedProspectiveValidation((pairs as any[]).map(x=>({time:new Date(x.time).toISOString(),baselineLoss:Number(x.baseline_loss),challengerLoss:Number(x.challenger_loss)})));
  const execution=(executionRows as any[])[0]??null;
  const portfolio=(portfolioRows as any[])[0]??null;
  const executionSlippageValidated=Boolean(execution?.execution_slippage_validated);
  const costAdjustedReturnLowerBound=executionSlippageValidated&&Boolean(execution?.modeled_cost_mature)&&execution?.lower_bound!=null?Number(execution.lower_bound):null;
  const scientificStatus=phase5ScientificStatus({immutableRecords:Number(r.immutable_records),independentlyCertifiedSourceTimes:Number(r.source_time_verified),pairedSamples:paired.pairs,independentSessions:paired.sessions,pairedSkillLowerBound:paired.lowerBound,modeledCostLowerBound:execution?.lower_bound==null?null:Number(execution.lower_bound),modeledCostMature:Boolean(execution?.modeled_cost_mature),empiricalSlippageValidated:executionSlippageValidated,portfolioReconciled:Boolean(portfolio?.portfolio_reconciled)});
  const evidence={
   total:Number(r.total),immutableRecords:Number(r.immutable_records),
   sourceTimeVerified:Number(r.source_time_verified),publicationTimeApplicable:false,publicationTimeVerified:Number(r.publication_time_verified),
   outOfSamplePaired:paired.pairs,independentSessionDates:paired.sessions,
   predictiveSkillLowerBound:paired.lowerBound,
   costAdjustedReturnLowerBound,
   portfolioReconciled:Boolean(portfolio?.portfolio_reconciled),executionSlippageValidated
  };
  return NextResponse.json({
   generatedAt:new Date().toISOString(),trial:{researchActivation:TRIAL_ACTIVATION,certificationActivation:CERTIFICATION_ACTIVATION,baseline:BASELINE_VERSION,challenger:CHALLENGER_VERSION},
   structuralIntegrity:{immutableRecords:Number(r.immutable_records),structuralPointInTime:Number(r.structural_point_in_time),strictSourceVerified:Number(r.strict_source_verified),invalidOutcomeChronology:Number(r.invalid_outcome_chronology)},
   pairedValidation:paired,portfolioReconciliation:portfolio?{createdAt:portfolio.created_at,environment:portfolio.environment,historyComplete:Boolean(portfolio.history_complete),transactionLineageComplete:Boolean(portfolio.transaction_lineage_complete),portfolioReconciled:Boolean(portfolio.portfolio_reconciled)}:null,executionValidation:execution?{createdAt:execution.created_at,samples:Number(execution.sample_count),sessions:Number(execution.session_count),meanGross:execution.mean_gross,meanQuotedSpreadCost:execution.mean_quoted_roundtrip_spread_cost,meanNetAfterQuotedSpread:execution.mean_net_after_quoted_spread,empiricalRoundTripSlippageFraction:execution.empirical_roundtrip_slippage_fraction,meanNetAfterAllModeledCosts:execution.mean_net_after_all_modeled_costs,lowerBound:execution.lower_bound,upperBound:execution.upper_bound,modeledCostMature:Boolean(execution.modeled_cost_mature),executionSlippageValidated}:null,scientificStatus,evidence,...certifyResearch(evidence),
   method:"Prospective matched baseline/challenger Brier-loss comparison from immutable forecast records plus Phase 5 execution-realism snapshots. Source-time credit is granted only by append-only independent source-time certification records. Quoted-spread modeling alone never qualifies as empirical slippage. Portfolio reconciliation remains fail-closed."
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return NextResponse.json({status:"UNAVAILABLE",reason:"Certification evidence could not be independently read",error:e instanceof Error?e.message:"unknown"},{status:503});
 }
}
