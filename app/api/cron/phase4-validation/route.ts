import {readComparablePairs,validateComparablePairs,comparisonDiagnostics} from "../../../../lib/research/comparable-pair-reader";
import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {BASELINE_VERSION,CHALLENGER_VERSION,TRIAL_ACTIVATION} from "../../../../lib/research/frozenChallenger";
import {phase4InfrastructureGate} from "../../../../lib/research/phase4-validation";
import {phase4ScientificBlockers} from "../../../../lib/research/phase4-blockers";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 try{
  const [integrity,pairs,invalid,protections]=await Promise.all([
   sql`select
      count(*)::int as immutable_records,
      count(*) filter(where i.forecast_id is not null)::int as immutable_linked,
      count(*) filter(where i.observed_at<=i.recorded_at+interval '1 minute')::int as structural_point_in_time,
      count(a.id)::int as source_attested,
      count(v.id)::int as strict_source_verified,
      count(*) filter(where coalesce(v.source_payload_hash,a.source_payload_hash) is not null and coalesce(v.source_payload_hash,a.source_payload_hash)<>'')::int as source_hash_attested,
      count(*) filter(where o.forecast_id is not null)::int as resolved_outcomes,
      count(*) filter(where o.forecast_id is not null and o.resolved_at>=f.created_at)::int as outcome_chronology_ok,
      count(distinct i.model_fingerprint) filter(where i.model_version=${BASELINE_VERSION})::int as baseline_fingerprints,
      count(distinct i.model_fingerprint) filter(where i.model_version=${CHALLENGER_VERSION})::int as challenger_fingerprints,
      count(*) filter(where i.source_type='exchange_time_verified')::int as independently_verified_source_times
    from immutable_decision_records i
    join forecast_ledger f on f.id=i.forecast_id
    left join forecast_outcomes o on o.forecast_id=f.id
    left join tradeos_decision_source_attestations a on a.immutable_decision_id=i.id
    left join tradeos_decision_source_verifications v on v.immutable_decision_id=i.id
    where i.recorded_at>=${TRIAL_ACTIVATION}::timestamptz`,
   readComparablePairs(sql,TRIAL_ACTIVATION),
   sql`select count(*)::int as evidence_rows,count(distinct factor_key)::int as evidence_factors,
      count(*) filter(where available_at<observed_at)::int as invalid_vintages,
      count(*) filter(where available_at<observed_at or available_at>now()+interval '1 minute' or trim(source_name)='' or trim(subject)='' or domain not in ('stock','option','macro','news','portfolio') or value::text in ('NaN','Infinity','-Infinity'))::int as invalid_rows
      from tradeos_factor_evidence`,
   sql`select count(distinct c.relname)::int as protected_tables from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and t.tgname in ('forecast_ledger_protect','forecast_outcomes_protect','immutable_decision_records_protect','source_observations_protect','tradeos_factor_evidence_protect','tradeos_decision_source_attestations_protect','tradeos_decision_source_verifications_protect')`
  ]);
  const paired=validateComparablePairs(pairs);
  const x=integrity[0] as any;
  const gate=phase4InfrastructureGate({
   immutableRecords:Number(x.immutable_records??0),immutableLinked:Number(x.immutable_linked??0),
   sourceAttested:Number(x.source_attested??0),strictSourceVerified:Number(x.strict_source_verified??0),sourceHashAttested:Number(x.source_hash_attested??0),
   structuralPointInTime:Number(x.structural_point_in_time??0),resolvedOutcomes:Number(x.resolved_outcomes??0),
   outcomeChronologyOk:Number(x.outcome_chronology_ok??0),baselineFingerprints:Number(x.baseline_fingerprints??0),
   challengerFingerprints:Number(x.challenger_fingerprints??0),pairedSamples:paired.pairs,sessionDates:paired.sessions,
   invalidEvidenceVintages:Number((invalid[0] as any)?.invalid_vintages??0),factorEvidenceRows:Number((invalid[0] as any)?.evidence_rows??0),factorEvidenceFactors:Number((invalid[0] as any)?.evidence_factors??0),invalidFactorEvidenceRows:Number((invalid[0] as any)?.invalid_rows??0),appendOnlyProtectedTables:Number((protections[0] as any)?.protected_tables??0)
  });
  const scientificStatus=phase4ScientificBlockers({pairedSamples:paired.pairs,sessionDates:paired.sessions,pairedLowerBound:paired.lowerBound,independentlyVerifiedSourceTimes:Number(x.independently_verified_source_times??0),immutableRecords:Number(x.immutable_records??0),costAdjustedReturnLowerBound:null,executionSlippageValidated:false,portfolioReconciled:false,publicationTimeApplicable:false,publicationTimeVerified:0});
  const payload={generatedAt:new Date().toISOString(),trialActivation:TRIAL_ACTIVATION,baselineVersion:BASELINE_VERSION,challengerVersion:CHALLENGER_VERSION,integrity:x,paired,...comparisonDiagnostics(pairs),gate,scientificStatus};
  const hour=new Date().toISOString().slice(0,13);
  await sql`insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
    select 'phase4_validation_snapshot','research_trial',${hour},${CHALLENGER_VERSION},${JSON.stringify(payload)}::jsonb
    where not exists(select 1 from audit_events where event_type='phase4_validation_snapshot' and entity_id=${hour})`;
  await recordCollectorReceipt({collector:"phase4_validation",status:"finished",received:paired.pairs,saved:1,details:{gatePassed:gate.passed,sessions:paired.sessions,lowerBound:paired.lowerBound,scientificMaturity:scientificStatus.scientificallyMature}});
  return NextResponse.json({...payload,approvedForTrading:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"phase4_validation",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch{}
  return NextResponse.json({status:"phase4_validation_failed",error:failureDetail(e),approvedForTrading:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
