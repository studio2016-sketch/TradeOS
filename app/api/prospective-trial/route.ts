import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {TRIAL_ACTIVATION,BASELINE_VERSION,CHALLENGER_VERSION} from "../../../lib/research/frozenChallenger";
import {selectComparableProspectivePairs} from "../../../lib/research/comparable-prospective-pairs";
import {evaluateProspectivePairs} from "../../../lib/research/prospectiveTrial";
import {evaluatePredictionOutcomeRow,summarizePredictionOutcomeEntries} from "../../../lib/research/prediction-outcome-ledger";
import {PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT} from "../../../lib/research/prediction-outcome-verdict";
import type {SourceTimeCertificate} from "../../../lib/research/source-time-certification";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Research database unavailable"},{status:503});
 try{
  const sql=db();
  const [rows,outcomeRows,certificateRows]=await Promise.all([sql`
    select b.observed_at as observed_at,b.symbol as symbol,
      f1.id::text baseline_id,f2.id::text challenger_id,
      f1.horizon baseline_horizon,f2.horizon challenger_horizon,
      f1.direction baseline_direction,f2.direction challenger_direction,
      f1.created_at baseline_created_at,f2.created_at challenger_created_at,
      f1.source_snapshot baseline_snapshot,f2.source_snapshot challenger_snapshot,
      o1.realized_return baseline_return,o2.realized_return challenger_return,
      o1.notes baseline_notes,o2.notes challenger_notes,
      f1.probability::float as baseline_probability,
      f2.probability::float as challenger_probability,
      o1.was_correct as baseline_outcome,o2.was_correct as challenger_outcome
    from immutable_decision_records b
    join immutable_decision_records c
      on c.symbol=b.symbol and c.observed_at=b.observed_at and c.model_version=${CHALLENGER_VERSION}
    join forecast_ledger f1 on f1.id=b.forecast_id
    join forecast_ledger f2 on f2.id=c.forecast_id
    join forecast_outcomes o1 on o1.forecast_id=f1.id
    join forecast_outcomes o2 on o2.forecast_id=f2.id
    where b.model_version=${BASELINE_VERSION}
      and b.observed_at>=${TRIAL_ACTIVATION}::timestamptz
      and b.recorded_at>=${TRIAL_ACTIVATION}::timestamptz
      and c.recorded_at>=${TRIAL_ACTIVATION}::timestamptz
      and o1.was_correct is not null and o2.was_correct is not null
    order by b.recorded_at asc limit 10001
  `,sql`select f.id,f.created_at,f.symbol,f.horizon,f.model_version,f.direction,f.probability,f.source_snapshot,
      o.resolved_at,o.realized_return,o.max_favorable_excursion,o.max_adverse_excursion,o.notes,
      vs.source_id as reconstructed_source_id
    from forecast_ledger f left join forecast_outcomes o on o.forecast_id=f.id
    left join immutable_decision_records i on i.forecast_id=f.id
    left join tradeos_decision_source_verifications dv on dv.immutable_decision_id=i.id
    left join source_observations vs on vs.id=dv.source_observation_id
    where f.created_at>=${PREDICTION_OUTCOME_PROTOCOL_ACTIVATION}::timestamptz
    order by f.created_at`,sql`select provider,feed,certification_kind,valid_from,valid_to,created_at
    from tradeos_source_time_certifications order by created_at`]);
  const pairing=selectComparableProspectivePairs(rows as any[]);
  const certificates:SourceTimeCertificate[]=(certificateRows as any[]).map(row=>({provider:String(row.provider),feed:String(row.feed),certification_kind:String(row.certification_kind),valid_from:new Date(row.valid_from).toISOString(),valid_to:row.valid_to?new Date(row.valid_to).toISOString():null,created_at:new Date(row.created_at).toISOString()}));
  const scientificEntries=(outcomeRows as any[]).map(row=>evaluatePredictionOutcomeRow(row,certificates));
  const scientificCohort=summarizePredictionOutcomeEntries(scientificEntries);
  return NextResponse.json({trial:{baseline:BASELINE_VERSION,challenger:CHALLENGER_VERSION,
    frozenAt:"2026-10-18",activatedAt:TRIAL_ACTIVATION,outcomeProtocolActivatedAt:PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,outcomeDisagreements:pairing.outcomeDisagreements,
    evidenceClass:"PROTOCOL_BOUND_COMPARATIVE_RESEARCH",scope:"Only one-to-one outcomes bound to the current frozen protocol and matching actual outcome observations/values. Source timing remains uncertified.",
    ...evaluateProspectivePairs(pairing.prospectivePairs)},
    pairing:pairing.diagnostics,
    historicalReconstruction:{evidenceClass:"HISTORICAL_RECONSTRUCTION",scope:"Separate retrospective research; excluded from prospective counts and scientific gates.",...evaluateProspectivePairs(pairing.reconstructedPairs),status:"HISTORICAL_RECONSTRUCTION",eligibleForProspectiveDepth:false,warnings:["Retrospective outcomes compatible with current endpoint/cost checks; not proof of a prospectively frozen outcome policy or certified source timing."]},certifiedOutcomeCohort:{activation:PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,
    fingerprint:PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,evidenceClass:"SOURCE_TIME_CERTIFIED_PROSPECTIVE_OUTCOMES",
    ...scientificCohort},interpretation:{relativeComparison:"A challenger improvement, if observed, is relative to the frozen baseline only.",
    absolutePredictiveClaim:false,profitabilityClaim:false,independentCertification:false,
    reason:"Relative Brier improvement does not establish absolute predictive skill, positive net returns, independent execution validation, or brokerage reconciliation."},
    status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),noAutomaticPromotion:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",reason:"Paired outcome trial could not be retrieved"},{status:503})}
}
