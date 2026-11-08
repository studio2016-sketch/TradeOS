# Read-only receipt-delay and endpoint-timing diagnostics

This proposal depends on the strict timestamp parser in PR #84. It adds an offline diagnostic and CLI; it neither activates the v4 outcome proposal nor changes any outcome receipt deadline. Existing v3 forecast bindings remain intact.

## Meaning of the classifications

An explicit as-of, retrieval-completeness assertion and a stored forecast's supported supplemental entry capture are required. Each forecast uses its own creation time, horizon, frozen source and symbol. The capture cutoff and entry chronology must precede that actual creation time. A missing or unsupported capture is unverified.

The quote window is horizon through horizon plus the existing fifteen-minute grace, inclusively. Receipt must also fall inside the grace to count as on-time timing. Only observations known by the supplied as-of are inspected. A quote inside the quote window but received after the deadline is counted as late, not admitted to any outcome calculation.

| Classification | Meaning |
| --- | --- |
| ON_TIME_ENDPOINT_TIMING | At least one same-source/symbol quote has on-time quote and receipt timestamps. Prices are not validated here. |
| LATE_ONLY | Quotes inside the quote window exist, but all known receipts missed the deadline. |
| NO_CAPTURED_ENDPOINT | No captured quote inside the quote window was found by as-of. This is not proof the exchange had no quote. |
| PENDING | The fixed receipt grace has not closed. |
| INCOMPLETE | Retrieval cannot support an absence or coverage conclusion. |
| UNVERIFIED | The frozen supplemental capture or its chronology is unsupported. |

Only mature, complete, supported forecasts enter coverage-rate denominators. Forecast counts can include baseline/challenger pairs and are not independent market tests. Duplicate forecast IDs and contradictory observation IDs fail the export. Identical observation copies are deduplicated. Limits of 10,000 forecasts, 100,000 rows and five million potential comparisons keep offline work bounded.

Receipt-delay quantiles use nearest rank over unique captured observation IDs whose quote times fall in at least one supported source/symbol horizon window. The same observation shared by paired forecasts counts once. Tails include late known receipts; they are not discarded for being late. Nanosecond results are emitted as exact decimal strings. These are delays from quote timestamp to local receipt, not provider publication latency or proof of exchange coverage. Sample quantiles may include supported windows that are pending or incomplete; they remain descriptive only.

No prices, realized returns, profit/loss, favorable outcome filtering, certification or policy optimization is used. Historical lateness cannot silently widen the frozen deadline. A prospective deadline revision would require a separately reviewed methodology and explicit owner approval.

## Offline export and invocation

```
node --import tsx scripts/check-receipt-delays.ts authorized-export.json
```

The JSON envelope contains `asOf`, boolean `retrievalComplete`, `forecasts`, and `observations`. Each forecast contains `id`, `symbol`, exact `created_at` text, integer `horizonMs`, and original `source_snapshot`. Each observation contains `id`, `symbol`, `sourceId`, exact `quoteAt` and `receivedAt` text. Do not truncate database timestamps through JavaScript Date during export.

The CLI has no database/provider/clock access and writes no files or records. An export query must cover all selected forecast horizon windows and receipts through the explicit as-of. Count a sentinel before claiming retrievalComplete=true. Completeness is only relative to currently stored records and the selected query; backdated inserts, source authenticity and feed completeness are not certified.

## Real-observation sample

A single read-only database query on November 8, 2026 selected the latest 30 `30m` forecasts with CAPTURED_PROPOSAL entries, created between November 6 19:10:16.520457+00 and 21:00:16.709764+00. It returned 150 matching IEX observation rows, below the 10,001-row sentinel, as of `2026-11-08 14:09:21.573014+00`. These timestamps are UTC; the query did not invoke a collector or modify evidence.

| Timing result | Forecast count |
| --- | ---: |
| On-time endpoint timing | 16 |
| Late-only | 0 |
| No captured endpoint | 14 |
| Pending / incomplete / unverified | 0 |

Twenty-four unique horizon-window observation IDs contributed delays. Median was 171,482,729 ns (about 0.171 seconds); p95 was 3,487,711,841 ns (about 3.49 seconds); maximum was 3,593,416,603 ns. A separate Python calculation using integer nanoseconds matched the three timing counts, unique quote count and p95. This is arithmetic/diagnostic agreement within the same development effort, not independent scientific certification.

This small, deliberately recent sample includes paired forecasts and late-session windows. No cause is established for the 14 missing endpoints, and the sample does not justify changing the grace. No raw user export is committed. Nine synthetic regression tests separately cover boundary precision, late-only versus missing status, incomplete retrieval, still-open grace, feed/symbol identity, deduplication, conflicts, future receipts, quantile tails and independence from prices/returns.
