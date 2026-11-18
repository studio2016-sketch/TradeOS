import {BASELINE_VERSION,CHALLENGER_VERSION} from './frozenChallenger';
import {selectComparableProspectivePairs} from './comparable-prospective-pairs';
import {pairedProspectiveValidation} from './phase4-validation';

export const COMPARABLE_PAIR_POLICY="tradeos.comparable-prospective-pairs.v1";

/** Shared read-only candidate reader. The one-row sentinel makes partial cohorts fail closed.
 * Callers supply their existing activation boundary; no stored outcomes are altered.
 */
export async function readComparablePairs(sql:any,activation:string){
 const candidates=await sql`with b as (select f.id,f.symbol,f.horizon,f.direction,f.source_snapshot,date_trunc('minute',f.created_at) bucket,f.created_at,f.probability,o.was_correct,o.realized_return,o.notes from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id where f.model_version=${BASELINE_VERSION} and f.created_at>=${activation}::timestamptz and o.was_correct is not null),
    c as (select f.id,f.symbol,f.horizon,f.direction,f.source_snapshot,date_trunc('minute',f.created_at) bucket,f.created_at,f.probability,o.was_correct,o.realized_return,o.notes from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id where f.model_version=${CHALLENGER_VERSION} and f.created_at>=${activation}::timestamptz and o.was_correct is not null)
    select b.created_at observed_at,b.symbol,
      b.id::text baseline_id,c.id::text challenger_id,
      b.horizon baseline_horizon,c.horizon challenger_horizon,
      b.direction baseline_direction,c.direction challenger_direction,
      b.created_at baseline_created_at,c.created_at challenger_created_at,
      b.source_snapshot baseline_snapshot,c.source_snapshot challenger_snapshot,
      b.realized_return baseline_return,c.realized_return challenger_return,
      b.notes baseline_notes,c.notes challenger_notes,b.probability::float baseline_probability,c.probability::float challenger_probability,b.was_correct baseline_outcome,c.was_correct challenger_outcome from b join c using(symbol,horizon,bucket) order by b.created_at asc limit 10001`;
 return selectComparableProspectivePairs(candidates as any[]);
}
export function validateComparablePairs(pairing:ReturnType<typeof selectComparableProspectivePairs>){
 return pairedProspectiveValidation(pairing.prospectivePairs.map(p=>({time:p.timestamp,
  baselineLoss:(p.baselineP-p.outcome)**2,challengerLoss:(p.challengerP-p.outcome)**2})));
}
export function comparisonDiagnostics(pairing:ReturnType<typeof selectComparableProspectivePairs>){
 return {pairingPolicy:COMPARABLE_PAIR_POLICY,pairing:pairing.diagnostics,outcomeDisagreements:pairing.outcomeDisagreements,
  historicalReconstruction:{pairs:pairing.reconstructedPairs.length,eligibleForProspectiveDepth:false as const}};
}
