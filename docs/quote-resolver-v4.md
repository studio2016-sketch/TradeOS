# Inactive v4 quote resolver and observational replay

`lib/research/quote-resolver-v4.ts` integrates PR #79's supplemental entry capture with PR #77's frozen-quote selector in a read-only, separately fingerprinted resolver. Its activation is null. No active dispatcher, forecast binding, certification gate, v3 reader, stored outcome or promotion rule changes.

## Evidence contract

The caller supplies an explicit stored forecast and as-of time. The capture must have the supported capture and selector fingerprints, source `Alpaca:iex`, matching symbol, capture cutoff no later than this particular forecast's creation, and entry quote and receipt no later than capture. Entry selection never depends on endpoint availability. Readback must match every frozen entry field exactly, and each evidence row must retain its payload hash and stable ID. Conflicting IDs, sources, timestamps or prices fail closed.

Draft 2 computes the upper deadline with PostgreSQL timestamp arithmetic using the original creation-time string; it never roundtrips that deadline through JavaScript Date. A read-only PostgreSQL boundary experiment confirmed that a receipt at 14:45:00.000500 belongs to a 14:45:00.000999 deadline and would have been wrongly omitted by a millisecond-truncated bound.

The adapter uses one SELECT snapshot for entry readback and endpoint retrieval. Endpoint receipts are bounded from forecast creation to the lesser of as-of and horizon plus fifteen minutes. A 10,001-row sentinel rejects sets exceeding 10,000 before deduplication. Failed queries are redacted and unavailable. The query's completeness means complete among currently stored rows in this receipt interval; it does not establish complete exchange coverage, absence of later backdated database insertion, provider completeness, or raw-payload authenticity. No alternate feed fallback is permitted.

The selector waits for the fixed receipt grace to close, then uses the first captured same-feed quote at or after the horizon whose receipt also meets the deadline. No valid endpoint after complete retrieval means VOID. Missing evidence, conflicts and incomplete retrieval mean UNVERIFIED, never PASS. Prices are positive non-crossed bid/ask midpoints; locked markets remain permitted. No pre-entry excursions, execution-price claim, directional pass/fail classification or promotion eligibility is produced.

Timestamp strings retain nanosecond quote and microsecond receipt precision. The underlying selector compares milliseconds. The adapter uses exact fractional comparisons to reject any boundary comparison or quote/receipt ordering tie whose meaning could change after truncation. Non-ambiguous submillisecond observations are supported. This conservative policy avoids claiming an exact ordering the existing selector does not implement. Impossible calendar values and missing zones fail closed.

Every selector result is also compared with `quote-outcome-reference.ts`, a separately implemented reference using its own nanosecond timestamp parser, sorted conflict scans, linear endpoint selection and algebraically different midpoint/return arithmetic. Status must agree, and selected IDs and numeric results must agree for reproducible outcomes (absolute plus relative tolerance 1e-12). Disagreement returns UNVERIFIED. This is local software cross-checking by the same development effort, not independent scientific certification.

The output contains a detached evidence bundle and canonical SHA-256 digest stable across JSON object-key order and endpoint row order. Typed entry/endpoint row roles make the bundle directly replayable. `verifyQuoteReplayV4` checks the bundle checksum and current policy fingerprint, recomputes the result, and rejects modified result fields, evidence, endpoint identities or certification claims. A checksum does not prevent an adversary replacing both evidence and checksum; trusted storage and source attestations remain necessary. This is a reproducibility checksum, not a signature or attestation. The read-only module never persists or rewrites outcomes. Exports remain separate research artifacts, never replacements for append-only v3 ledger records.

## Reproduce an authorized export

Export `{forecast,rows,complete}` with forecast fields `id`, exact `created_at` text, `symbol`, `horizonMs`, and `source_snapshot`. Rows retain `kind` (`entry` or `endpoint`), `id`, `symbol`, `source_id`, exact `received_at` text, `metadata`, and `payload_hash`. Assert `complete:true` only after checking retrieval was not truncated and used the documented receipt window.

```
node --import tsx scripts/replay-quote-outcome-v4.ts authorized-export.json 2026-11-07T13:00:00.000Z
```

The returned `evidenceBundle` can be passed directly as the next export input. To verify a saved full report:

```
node --import tsx scripts/replay-quote-outcome-v4.ts archived-report.json --verify
```

The envelope parser rejects unknown row kinds and nonboolean completeness so dropped rows cannot silently masquerade as complete evidence. No automatic database access, credentials, provider fetch, current-clock substitution, inserts or updates occur in this CLI. Synthetic adapter tests exercise JSON persistence/readback and stubbed SQL; they do not certify a database deployment.

## Real observations checked on November 7, 2026

Read-only queries against the connected TradeOS database counted 3,489 forecasts, 228 containing supplemental capture, and 154 with CAPTURED_PROPOSAL entries. All 154 retained submillisecond forecast and quote timestamps. These counts are a snapshot, not a full cohort certification.

Two deliberately selected QQQ examples were exported and replayed as of `2026-11-07T13:00:00.000Z`:

| Forecast | Entry observation | Endpoint | Result |
| --- | --- | --- | --- |
| 3413, created 2026-11-06 18:55:16.352509+00 | 18911, bid 658.36 / ask 658.57 | 18953, bid 658.19 / ask 658.24; quote 19:30:13.862125339Z | REPRODUCIBLE_PROPOSAL; return -0.0003796709012627854; entry spread ratio 0.000318923557060795 |
| 3449, created 2026-11-06 20:55:16.263798+00 | 19055 | No eligible endpoint | VOID, NO_ELIGIBLE_SAME_SOURCE_ENDPOINT |

The first export contained one entry and nine receipt-window rows; the second one entry and two receipt-window rows. Neither hit a retrieval limit. The first endpoint was separately checked by midpoint arithmetic: `(658.215 - 658.465) / 658.465`. The draft-2 separately implemented reference also reproduced this example’s selected endpoint and numerical results; archived-report replay verification passed. This does not certify source publication timing or feed completeness. The actual draft-2 adapter SELECT was also executed read-only against this forecast and returned the same ten evidence rows. Raw user evidence exports are not committed to GitHub. Both forecasts retain their original v3 binding; these results are explicitly retrospective diagnostic replays of prospectively captured supplemental evidence, not prospective v4 validation.

## Requirements before any activation

Obtain owner approval for the exact protocol policy and prospective activation boundary. Freeze the new fingerprint, selected entry, true per-forecast creation time and shared pair identity in append-only records at prediction creation. Define transactional creation/readback guarantees and database permissions preventing backdated evidence mutation; hashes alone cannot prove these. Make dispatch, audit, pair comparisons and ledger readers version aware before inserting any v4 outcomes. Enforce unique append-only resolution identities; never overwrite, backfill or reclassify v3. Retain existing v3 conformance and model-promotion blocks.

Separately verify raw-payload provenance, source timestamp semantics, feed coverage, and independent resolver conformance against actual newly activated records. Replay success does not satisfy these requirements. No activation, consequential merge, production evidence modification or live trading is authorized by this PR.
