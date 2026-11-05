# Offline paired-risk arithmetic cross-check

This adds a separately authored mathematical reference, not independent scientific certification. It reads local exports of the forward-only risk bundles and does not contact providers or databases, change evidence, submit orders, or promote any audit gate.

## Run

After installing the repository dependencies:

```
node --import tsx scripts/check-risk-replay.ts rows.json
```

The input is a JSON array of exported `tradeos_factor_evidence` rows containing `factor_key`, `subject`, `source_name`, numeric `value`, string `observed_at`, string `available_at`, and object `source_metadata`. The caller obtains this export through its own authorized read-only workflow. The script itself has no credentials or database access. Timestamp strings are normalized to ISO milliseconds to match the collector's original row binding.

The report goes to stdout. Exit 0 requires at least one row and every row reporting `REFERENCE_AGREES`; empty, mixed, invalid or disagreeing exports exit 1. Agreement is never certification. All reports retain research-only status and false source-time, independent-replay certification, predictive and live-execution flags. No report is automatically stored or used to promote factors.

## What is separate

`reference-risk-statistics.ts` was written from the statistical specification without consulting the production helper. It uses online Welford co-moments and explicit sample covariance/variance rather than production's centered two-pass calculation. Its standalone fixtures derive expected values from affine, inverse and orthogonal return patterns without importing production arithmetic.

The reference validates exact 20/60-return windows, strictly increasing paired UTC dates, valid ISO calendar timestamps, positive finite closes and finite arithmetic. It can reject an impossible calendar date that JavaScript's production `Date.parse` normalizes. It returns null for the appropriate zero-variance denominators and never substitutes an arbitrary value.

## What is shared or still missing

The orchestrator first uses the existing production bundle checker to validate its digest, outer-row binding, supported implementation identity and same-code reproduction. This envelope validation is shared code. The reference consumes the same captured price inputs; it does not independently obtain source data. Its formula separation helps detect implementation discrepancies but does not prove input truth, publication timing, adjustment vintage, complete exchange sessions, model correctness or predictive skill. It is not an independent organization, audit authority or point-in-time strategy replay.

The predeclared numerical comparison is `abs(a-b) <= 1e-10 + 1e-9 * max(abs(a), abs(b))`. This accommodates floating-point algorithm differences; it is an engineering tolerance, not a confidence interval. The report retains both values and absolute difference. A disagreement requires investigation, never automatic substitution or widening tolerance.

Older records without bundles remain unverified. Unknown helper identities fail closed. Cross-checks are tested with synthetic fixtures and mocked exports; first real stored-row testing is a separate read-only step after a scheduled collection. Source-time certification, artifact/deployment attestation, preregistered prospective results, multiple-testing control and execution reconciliation remain unresolved requirements.

The reference accepts ISO dates or explicit-offset ISO datetimes with up to millisecond precision. It conservatively rejects other formats, finer fractional precision and impossible calendar values even if the production parser accepts them. Because the shared envelope checker executes first, this tool cannot independently assess a row that production validation already rejects. A deterministic near-constant-return stress fixture exercises an actual numerical disagreement between the algorithms; this is a reason to investigate conditioning, not proof either output is exact or authorization to change stored results.
