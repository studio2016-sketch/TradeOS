# Unactivated quote-outcome proposal

This pure selector is design groundwork, not an active resolver or a scientific certificate. It has no database/provider access and no production caller. The existing v3 protocol, forecasts, stored outcomes, and authorization gates are untouched.

## Why a separate method is needed

The active protocol describes midpoint returns, but the existing resolver uses snapshot `price`, populated by trade or bar-close adapters. Its event-time selection also differs from quote-time selection, and its entry source can depend on future endpoint availability. Changing that arithmetic while retaining the old fingerprint would hide a methodology change.

## Proposed contract

- A caller must freeze an explicit entry observation, source and symbol before considering future endpoints. Entry quote time must be within five minutes before the forecast; receipt must also precede the forecast.
- Only the same symbol/feed can supply an endpoint. Use the earliest quote timestamp at or after the requested horizon, with both quote and receipt inside fifteen minutes of the horizon and received by the supplied as-of time.
- Wait until the fixed receipt grace has closed before returning a result, even when an endpoint is already present. An earlier quote can still arrive within that grace. Known future-received or after-cutoff observations are ignored before value/conflict checks; missing receipt times fail closed.
- Use strictly finite positive bid/ask midpoints. Locked quotes are accepted with zero quoted spread; crossed quotes are rejected. The entry full spread divided by its midpoint is the quoted cost, not a guarantee of execution cost.
- Different prices claiming the same quote timestamp or conflicting stable IDs fail closed. Identical copies have deterministic receipt-time then lexical-ID ordering. Invalid same-source/symbol candidates reject the supplied set conservatively, including otherwise irrelevant times.
- A caller must assert that its bounded candidate query is complete. This assertion is not independently verified by the helper. A truncated or unknown candidate set must be marked incomplete.
- Return exact supplied endpoint fields and a proposal-policy fingerprint. That digest identifies declared policy, not deployed code, authenticity or independent attestation. No pass/fail grade or excursion estimate is produced.

The input fixtures are synthetic. No database assessment metrics, real observation identifiers, or captured user data are included.

## Required work before activation

1. Independently review the proposed receipt deadline and locked-market policy. These are explicit prospective choices, not reinterpretations of v3 outcomes.
2. Persist the frozen entry in a newly created forecast snapshot, atomically enough to demonstrate that it was selected before observing the outcome. Freeze the same entry for a baseline/challenger pair while retaining each forecast's true creation time. Input validation cannot itself prove this historical ordering.
3. Query by quote time and receipt time, not solely the snapshot trade timestamp. Preserve stable IDs, exact raw quote fields and source identity; establish complete pagination or a fail-closed sentinel. Provider snapshot frequency can miss earlier market quotes, so the result means earliest *captured* eligible quote, not earliest exchange quote.
4. Define an explicit reviewed activation boundary and new outcome implementation/protocol identity. Do not relabel old forecasts or apply corrected arithmetic under old fingerprints. Keep prior pending forecasts under a separately identified legacy policy or leave them unavailable pending a decision.
5. Make pairing, ledger and audit readers version-aware before switching the current protocol constant. Do not merge old and new cohorts, and do not promote old records based on a new code version.
6. Prove persistence/readback and actual resolver integration with synthetic end-to-end tests. Separately establish source publication timing and provider completeness; local receipt chronology is not either certificate.

No activation date is invented here. All results remain unactivated, source-time uncertified, independently uncertified and ineligible for live execution.
