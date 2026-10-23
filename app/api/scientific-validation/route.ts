import {NextResponse} from "next/server";
import {auth} from "../../../lib/auth/server";
import {db,hasDatabase} from "../../../lib/db";
import {BASELINE_VERSION,CHALLENGER_VERSION,CERTIFICATION_ACTIVATION} from "../../../lib/research/frozenChallenger";
import {evaluateProspectivePairs} from "../../../lib/research/prospectiveTrial";
import {assessScientificValidation} from "../../../lib/research/scientific-validation";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

export async function GET(){
 try{
  const session=await auth.getSession(),id=session.data?.user?.id;
  if(!id||id!==process.env.TRADEOS_OWNER_USER_ID||!hasDatabase())return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const sql=db();
  const owner=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
  if(owner[0]?.role!=="admin"||owner[0]?.banned===true||owner[0]?.verified!==true)return NextResponse.json({error:"Verified owner session required"},{status:403,headers});
  const [summary,modelRows,pairRows]=await Promise.all([
   sql`select
    (select count(*)::int from forecast_ledger where created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) forecast_total,
    (select count(*)::int from forecast_outcomes o join forecast_ledger f on f.id=o.forecast_id where f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and f.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and o.was_correct is not null) labelled_forecasts,
    (select count(distinct created_at::date)::int from forecast_ledger where created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) forecast_session_dates,
    (select count(*)::int from immutable_decision_records where recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) immutable_records,
    (select count(*)::int from immutable_decision_records where recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and observed_at<=recorded_at) time_ordered_immutable_records,
    (select count(*)::int from immutable_decision_records where recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and observed_at>recorded_at) future_dated_immutable_records,
    (select count(*)::int from immutable_decision_records i join forecast_ledger f on f.id=i.forecast_id join tradeos_decision_source_verifications v on v.immutable_decision_id=i.id join source_observations so on so.id=v.source_observation_id where i.recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and i.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and exists(select 1 from tradeos_source_time_certifications c where c.certification_kind='exchange_authoritative_timestamp' and lower(c.provider)=lower(split_part(so.source_id,':',1)) and lower(c.feed)=lower(split_part(so.source_id,':',2)) and c.created_at<=f.created_at and c.valid_from<=f.created_at and (c.valid_to is null or c.valid_to>f.created_at))) independently_timestamp_verified,
    (select count(*)::int from immutable_decision_records where recorded_at>=${CERTIFICATION_ACTIVATION}::timestamptz and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and source_type='primary_publication_time_verified') publication_time_verified,
    (select count(*)::int from tradeos_acceleration_observations) acceleration_records,
    (select count(distinct recorded_at::date)::int from tradeos_acceleration_observations) acceleration_session_dates,
    (select count(*)::int from tradeos_acceleration_trials) replay_trials,
    (select count(distinct costs_bps)::int from tradeos_acceleration_trials) replay_cost_levels`,
   sql`select f.model_version,f.horizon,count(*)::int recorded,
       count(*) filter(where o.was_correct is not null)::int labelled,
       count(distinct f.created_at::date)::int session_dates,
       avg(power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2)) filter(where o.was_correct is not null)::float brier
      from forecast_ledger f left join forecast_outcomes o on o.forecast_id=f.id
      group by f.model_version,f.horizon order by f.model_version,f.horizon`,
   sql`with b as (select f.symbol,f.horizon,date_trunc('minute',f.created_at) bucket,f.created_at,f.probability,o.was_correct from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id where f.model_version=${BASELINE_VERSION} and f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and o.was_correct is not null),
    c as (select f.symbol,f.horizon,date_trunc('minute',f.created_at) bucket,f.probability,o.was_correct from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id where f.model_version=${CHALLENGER_VERSION} and f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and o.was_correct is not null)
    select b.created_at observed_at,b.symbol,b.probability::float baseline_probability,c.probability::float challenger_probability,b.was_correct baseline_outcome,c.was_correct challenger_outcome from b join c using(symbol,horizon,bucket) order by b.created_at asc limit 10000`
  ]);
  let outcomeDisagreements=0;
  const paired=[];
  for(const row of pairRows as any[]){
   if(Boolean(row.baseline_outcome)!==Boolean(row.challenger_outcome)){outcomeDisagreements++;continue;}
   paired.push({timestamp:new Date(row.observed_at).toISOString(),symbol:String(row.symbol),baselineP:Number(row.baseline_probability),challengerP:Number(row.challenger_probability),outcome:(row.baseline_outcome?1:0) as 0|1});
  }
  const prospective=evaluateProspectivePairs(paired),raw=(summary as any[])[0];
  const input={forecastTotal:Number(raw.forecast_total),labelledForecasts:Number(raw.labelled_forecasts),forecastSessionDates:Number(raw.forecast_session_dates),
   immutableRecords:Number(raw.immutable_records),timeOrderedImmutableRecords:Number(raw.time_ordered_immutable_records),futureDatedImmutableRecords:Number(raw.future_dated_immutable_records),
   independentlyTimestampVerified:Number(raw.independently_timestamp_verified),publicationTimeVerified:Number(raw.publication_time_verified),
   accelerationRecords:Number(raw.acceleration_records),accelerationSessionDates:Number(raw.acceleration_session_dates),replayTrials:Number(raw.replay_trials),replayCostLevels:Number(raw.replay_cost_levels),
   prospectivePairs:prospective.pairedCount,prospectiveSessionDates:prospective.independentSessionDates,prospectiveIntervalLow:prospective.clustered95PctInterval?.[0]??null,
   executionSlippageValidated:false,brokerReconciled:false,independentReplayVerified:false,registeredHypothesisFamily:false};
  return NextResponse.json({generatedAt:new Date().toISOString(),assessment:assessScientificValidation(input),evidence:input,
   prospective:{baseline:BASELINE_VERSION,challenger:CHALLENGER_VERSION,activatedAt:CERTIFICATION_ACTIVATION,outcomeDisagreements,...prospective},
   models:(modelRows as any[]).map(r=>({model:r.model_version,horizon:r.horizon,recorded:Number(r.recorded),labelled:Number(r.labelled),sessionDates:Number(r.session_dates),brier:r.brier==null?null:Number(r.brier),status:"RESEARCH_ONLY"})),
   policy:"Measurement coverage is not predictive validation. Only independent, prospective, multiple-testing-adjusted, cost-validated evidence may become eligible for reviewed model influence."},{headers});
 }catch(error){return NextResponse.json({error:"Scientific validation evidence unavailable",reason:error instanceof Error?error.message:"unknown"},{status:503,headers});}
}
