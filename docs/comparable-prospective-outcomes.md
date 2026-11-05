# Comparable outcomes in frozen-model research

Equal correctness labels do not prove two predictions were evaluated on the same outcome. Both comparison APIs now select one-to-one comparable outcomes before calculating relative Brier scores. Existing forecasts/outcomes remain untouched.

## Current-protocol cohort

The prospective cohort requires the current frozen outcome protocol in BOTH the forecast snapshot and outcome notes. Contradictory/unknown evidence classes are excluded, including a historical-reconstruction marker combined with bound metadata. Forecast creation must be on/after the protocol activation. Matching labels alone never promotes a row.

The gate also requires matching horizon duration and direction, source identity, start/end observations, finite stored return, quoted cost and edge threshold. Each label/disposition must be reproducible from its stored return, direction, cost and threshold. Stored numeric equality is exact after decimal parsing; there is no fitted tolerance. Borderline rounded values can therefore be excluded rather than regraded or rewritten.

Both forecasts must satisfy the already frozen input window: latest start observation at/before prediction within five minutes, evaluation at/after the horizon within fifteen minutes. These checks establish compatibility with the frozen policy, not independently verified source timestamps or execution fills.

## Separate reconstruction cohort

Matching explicit HISTORICAL_RECONSTRUCTION rows may be retained as retrospective research after the same outcome-identity, numeric, label and current-window compatibility checks. They are NEVER pooled into prospective counts, confidence intervals or scientific depth gates. The response labels this cohort separately, with `eligibleForProspectiveDepth: false`. Its compatibility does not prove the policy was registered before those predictions.

Missing/unparseable notes, conflicting values/timestamps, uncertain bindings, invalid labels and ambiguous reused forecast IDs are excluded with counts by reason. All IDs must be unique across either role in the complete candidate set. APIs request 10,001 rows as a sentinel for a 10,000-candidate cap. A larger result fails the entire selection closed and reports `candidateSetComplete: false`; it never treats a truncated join as unique or sufficient evidence. It does not claim how many additional candidates exist beyond that sentinel.

## Remaining limits

This corrects comparison eligibility, not independent scientific certification. The APIs still depend on stored notes and candidate joins, use the existing UTC-date clustered exploratory analysis, and do not independently verify source publication, original prices, overlapping labels, raw quote identity or economic accuracy. Aggregate model-history metrics outside the paired cohort remain descriptive and unchanged. Existing source-time-certified outcome reporting is unchanged. No automatic promotion, trading permission, order or database mutation is introduced.

Tests exercise the shared selector and both actual API handlers with mocked read-only SQL/authentication. SQL projections are checked using synthetic fixtures. No live API session, database write or provider request is required for these tests.
