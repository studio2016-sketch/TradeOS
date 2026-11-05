# Forward-only paired-risk replay evidence

New network-collector beta, rolling correlation and equity/bond correlation observations retain the exact paired timestamp/close windows used by the calculation in `source_metadata.riskReplay`. Other producers and historical rows remain unchanged.

The payload binds the factor, subject, source, value, source observation time, completion receipt time, own/benchmark symbols, feed, daily/all-adjusted input policy, exact sample count, and source-file SHA-256. The source digest is pinned to `synchronized-risk-statistics.ts`; a test hashes that actual file. Updating the implementation requires consciously updating its identity. It does not attest that a particular deployment passed CI. A later helper digest change makes old bundles unknown to this checker unless a reviewed historical implementation is retained.

Input closes remain unrounded JavaScript doubles, and timestamps retain their input strings. Windows are bounded to 61+61 observations for beta and 21+21 for each correlation. The seven-row mocked collector fixture produces 26,583 bytes of bundle JSON total: approximately 5.7 KB per beta and 2.4 KB per correlation before database compression. Real numeric representations can vary. No extra provider calls or credentials are included. The collector uses its existing inputs and records receipt after transport completes.

## Reproduce a stored row

Call `checkRiskReplayBundle(source_metadata.riskReplay, row)` from `lib/research/risk-replay-bundle.ts`. Supply only these normalized outer row fields:

- `factor` from `factor_key`
- `subject`
- `source` from `source_name`
- `value` as the original numeric value
- `observedAt` from `observed_at`, normalized to ISO milliseconds
- `availableAt` from `available_at`, normalized to ISO milliseconds

The checker compares the complete row binding, supported identity and input policy, exact input length, synchronized dates, recomputed value and observed timestamp. JSONB key reordering does not change the canonical SHA-256. Tests cover serialized metadata and simulated key reordering, not a live PostgreSQL write/read roundtrip. Legacy/missing, corrupt, unknown-implementation, mismatched or unreproducible bundles return `UNVERIFIED`. Valid bundles return `REPRODUCED` with `certified: false`.

This is same-implementation arithmetic reproduction, not independent verification. A digest detects inconsistency but is not authentication: someone able to replace both payload and digest can change them. The pinned source digest is an engineering reference, not a source-publication certificate, signed build attestation or proof of a historical producer. Existing audit, prediction and trading gates remain unchanged, including beta/correlation's unproven implementation-linkage gate.

## Remaining validation infrastructure

1. Review and register the exact deployed/tested artifact and an independently implemented reference calculation against exported rows. Retain results separately; never rewrite old evidence or infer certification from method labels.
2. Establish source publication timing, adjustment vintage and completeness from entitled independently verifiable source evidence. Receipt timestamps and matching dates do not establish these facts. The existing adapter can omit invalid rows; retained inputs describe what was actually used, not a guarantee of complete sessions.
3. Bind prospective hypothesis registration, frozen model artifacts and future outcomes to independently reproducible trials, with session clustering and multiple-testing control. Arithmetic reproducibility alone cannot establish predictive skill.
4. Reconcile execution/slippage and brokerage evidence separately before any live-execution claim. This change adds no order capability and grants no model influence.
