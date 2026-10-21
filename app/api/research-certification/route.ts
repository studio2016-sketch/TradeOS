import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {certifyResearch} from "../../../lib/research/certificationAuthority";
import {BASELINE_VERSION,CHALLENGER_VERSION,TRIAL_ACTIVATION} from "../../../lib/research/frozenChallenger";
import {pairedProspectiveValidation} from "../../../lib/research/phase4-validation";
export const dynamic="force-dynamic";

export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Research database disconnected"},{status:503});
 try{
  const sql=db();
  const [counts,pairs]=await Promise.all([
   sql`select
     (select count(*)::int from forecast_ledger where created_at>=${TRIAL_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as total,
     (select count(*)::int from immutable_decision_records where recorded_at>=${TRIAL_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as immutable_records,
     (select count(*)::int from immutable_decision_records where recorded_at>=${TRIAL_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and observed_at<=recorded_at+interval '1 minute') as structural_point_in_time,
     (select count(*)::int from immutable_decision_records where recorded_at>=${TRIAL_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and source_type='exchange_time_verified') as source_time_verified,
     (select count(*)::int from immutable_decision_records where recorded_at>=${TRIAL_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and source_type='primary_publication_time_verified') as publication_time_verified,
     (select count(*)::int from forecast_outcomes o join forecast_ledger f on f.id=o.forecast_id where f.created_at>=${TRIAL_ACTIVATION}::timestamptz and f.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and o.resolved_at<f.created_at) as invalid_outcome_chronology`,
   sql`with b as (
      select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,f.created_at,
        power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss
      from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
      where f.model_version=${BASELINE_VERSION} and f.created_at>=${TRIAL_ACTIVATION}::timestamptz and o.was_correct is not null
    ), c as (
      select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,
        power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss
      from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
      where f.model_version=${CHALLENGER_VERSION} and f.created_at>=${TRIAL_ACTIVATION}::timestamptz and o.was_correct is not null
    )
    select b.created_at as time,b.loss as baseline_loss,c.loss as challenger_loss
    from b join c using(symbol,horizon,bucket) order by b.created_at asc`
  ]);
  const r=(counts as any[])[0];
  const paired=pairedProspectiveValidation((pairs as any[]).map(x=>({time:new Date(x.time).toISOString(),baselineLoss:Number(x.baseline_loss),challengerLoss:Number(x.challenger_loss)})));
  const evidence={
   total:Number(r.total),immutableRecords:Number(r.immutable_records),
   sourceTimeVerified:Number(r.source_time_verified),publicationTimeVerified:Number(r.publication_time_verified),
   outOfSamplePaired:paired.pairs,independentSessionDates:paired.sessions,
   predictiveSkillLowerBound:paired.lowerBound,
   costAdjustedReturnLowerBound:null,
   portfolioReconciled:false,executionSlippageValidated:false
  };
  return NextResponse.json({
   generatedAt:new Date().toISOString(),trial:{activation:TRIAL_ACTIVATION,baseline:BASELINE_VERSION,challenger:CHALLENGER_VERSION},
   structuralIntegrity:{immutableRecords:Number(r.immutable_records),structuralPointInTime:Number(r.structural_point_in_time),invalidOutcomeChronology:Number(r.invalid_outcome_chronology)},
   pairedValidation:paired,evidence,...certifyResearch(evidence),
   method:"Prospective matched baseline/challenger Brier-loss comparison from immutable forecast records. Stored observation event times establish structural chronology but are not relabeled as independently exchange-certified timestamps. Cost, portfolio reconciliation, and independent publication-time gates remain fail-closed."
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return NextResponse.json({status:"UNAVAILABLE",reason:"Certification evidence could not be independently read",error:e instanceof Error?e.message:"unknown"},{status:503});
 }
}
