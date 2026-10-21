import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {BASELINE_VERSION,CHALLENGER_VERSION,TRIAL_ACTIVATION} from "../../../../lib/research/frozenChallenger";
import {pairedProspectiveValidation,phase4InfrastructureGate} from "../../../../lib/research/phase4-validation";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 try{
  const [integrity,pairs,invalid]=await Promise.all([
   sql\`select
      count(*)::int as immutable_records,
      count(*) filter(where i.forecast_id is not null)::int as immutable_linked,
      count(*) filter(where i.observed_at<=i.recorded_at+interval '1 minute')::int as structural_point_in_time,
      count(a.id)::int as source_attested,
      count(*) filter(where a.source_payload_hash is not null and a.source_payload_hash<>'')::int as source_hash_attested,
      count(*) filter(where o.forecast_id is not null)::int as resolved_outcomes,
      count(*) filter(where o.forecast_id is not null and o.resolved_at>=f.created_at)::int as outcome_chronology_ok,
      count(distinct i.model_fingerprint) filter(where i.model_version=\${BASELINE_VERSION})::int as baseline_fingerprints,
      count(distinct i.model_fingerprint) filter(where i.model_version=\${CHALLENGER_VERSION})::int as challenger_fingerprints
    from immutable_decision_records i
    join forecast_ledger f on f.id=i.forecast_id
    left join forecast_outcomes o on o.forecast_id=f.id
    left join tradeos_decision_source_attestations a on a.immutable_decision_id=i.id
    where i.recorded_at>=\${TRIAL_ACTIVATION}::timestamptz\`,
   sql\`with b as (
      select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,f.created_at,
        power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss
      from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
      where f.model_version=\${BASELINE_VERSION} and f.created_at>=\${TRIAL_ACTIVATION}::timestamptz and o.was_correct is not null
    ), c as (
      select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,
        power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss
      from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
      where f.model_version=\${CHALLENGER_VERSION} and f.created_at>=\${TRIAL_ACTIVATION}::timestamptz and o.was_correct is not null
    )
    select b.created_at as time,b.loss as baseline_loss,c.loss as challenger_loss
    from b join c using(symbol,horizon,bucket) order by b.created_at asc\`,
   sql\`select count(*)::int as invalid_vintages from tradeos_factor_evidence where available_at<observed_at\`
  ]);
  const paired=pairedProspectiveValidation(pairs.map((r:any)=>({time:new Date(r.time).toISOString(),baselineLoss:Number(r.baseline_loss),challengerLoss:Number(r.challenger_loss)})));
  const x=integrity[0] as any;
  const gate=phase4InfrastructureGate({
   immutableRecords:Number(x.immutable_records??0),immutableLinked:Number(x.immutable_linked??0),
   sourceAttested:Number(x.source_attested??0),sourceHashAttested:Number(x.source_hash_attested??0),
   structuralPointInTime:Number(x.structural_point_in_time??0),resolvedOutcomes:Number(x.resolved_outcomes??0),
   outcomeChronologyOk:Number(x.outcome_chronology_ok??0),baselineFingerprints:Number(x.baseline_fingerprints??0),
   challengerFingerprints:Number(x.challenger_fingerprints??0),pairedSamples:paired.pairs,sessionDates:paired.sessions,
   invalidEvidenceVintages:Number((invalid[0] as any)?.invalid_vintages??0)
  });
  const payload={generatedAt:new Date().toISOString(),trialActivation:TRIAL_ACTIVATION,baselineVersion:BASELINE_VERSION,challengerVersion:CHALLENGER_VERSION,integrity:x,paired,gate};
  const hour=new Date().toISOString().slice(0,13);
  await sql\`insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
    select 'phase4_validation_snapshot','research_trial',\${hour},\${CHALLENGER_VERSION},\${JSON.stringify(payload)}::jsonb
    where not exists(select 1 from audit_events where event_type='phase4_validation_snapshot' and entity_id=\${hour})\`;
  await recordCollectorReceipt({collector:"phase4_validation",status:"finished",received:paired.pairs,saved:1,details:{gatePassed:gate.passed,sessions:paired.sessions,lowerBound:paired.lowerBound,scientificMaturity:paired.mature}});
  return NextResponse.json({...payload,approvedForTrading:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"phase4_validation",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch{}
  return NextResponse.json({status:"phase4_validation_failed",error:failureDetail(e),approvedForTrading:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
