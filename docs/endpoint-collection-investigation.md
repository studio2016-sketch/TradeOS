# Captured endpoint collection investigation

## Verified result and scope

Read-only Neon production SELECTs on November 8, 2026 reproduced the PR #85 cohort of 30 captured 30-minute forecasts, retaining its explicit as-of `2026-11-08 14:09:21.573014+00`. The expanded observation query includes all stored feeds for those symbols from the earliest forecast creation time through that as-of. It returned 319 observations, below a 10,001-row overflow sentinel. A single-statement export also returned 27 ingestion audit records, below a 1,001-row sentinel. There were no collector calls, evidence writes or historical outcome changes. These are current stored records filtered by historical receipt/as-of, not proof against backdated insertions.

Timing results remain 16 on-time, zero late-only, and 14 missing. All 14 missing horizons fall after the November 6 regular close at 21:00 UTC. They comprise seven baseline/challenger pairs, not fourteen independent market opportunities. Each missing forecast has three completed ingestion runs starting during its own unchanged 15-minute endpoint window. All three report a positive aggregate Alpaca response count and no recorded errors. Missing IEX receipts therefore do **not** establish missed collector executions.

The following counts are per forecast; each row groups the two forecast IDs. Times are approximate UTC horizon times for presentation; calculations use exact timestamp text.

| Forecast IDs | Symbol | Horizon | Stored IEX receipts in window | Other-feed receipts in window | Completed ingest starts |
| --- | --- | --- | ---: | ---: | ---: |
| 3438, 3439 | NVDA | 21:00:16 | 2 | 1 delayed-SIP | 3 |
| 3440, 3441 | AMD | 21:00:16 | 1 | 0 | 3 |
| 3442, 3443 | IWM | 21:10:16 | 0 | 2 delayed-SIP | 3 |
| 3444, 3445 | PLTR | 21:25:16 | 0 | 3 delayed-SIP | 3 |
| 3446, 3447 | SPY | 21:25:16 | 1 | 0 | 3 |
| 3448, 3449 | QQQ | 21:25:16 | 0 | 3 delayed-SIP | 3 |
| 3452, 3453 | AMD | 21:30:17 | 1 | 0 | 3 |

All matching IEX quotes received in these windows predate their horizons. All stored delayed-SIP quotes received in these windows also predate their horizons; none supplies an on-time quote endpoint even before considering the frozen-feed mismatch. The six forecasts without matching IEX receipts all have delayed-SIP receipts. A separate temporary Python implementation using integer nanoseconds reproduced the 16/0/14 result and every per-forecast receipt/run count above. This is arithmetic agreement within the development effort, not independent scientific certification. Raw exports are not committed.

## Collection and persistence path

1. `vercel.json` schedules `/api/cron/ingest` every five minutes during hours 12–23 on weekdays. The observed audit records around these windows start near five-minute boundaries plus 13–14 seconds. Every missing forecast has three starts in its window; there is no evidence here of an omitted scheduled slot. The manifest is repository configuration; actual historical platform scheduling configuration is not independently attested.
2. Ingest calls `bestSnapshots(watchlist)`, normalizes Alpaca snapshot responses, and picks one snapshot per symbol by **price timestamp**, using latest trade before minute/daily close. Quote timestamps are separate. The normalized response count does not prove every requested symbol had a valid provider response: the adapter maps requested symbols, including empty entries.
3. If the selected price observation is over ten minutes old, delayed-SIP fallback is attempted. It can replace the IEX snapshot when its price timestamp is newer, even if the IEX quote timestamp is newer. This is reproducible in a mocked-provider test. It does not establish which losing IEX quote was returned historically. Massive attempts in these audits were disabled by entitlement policy, not failed market requests.
4. Only selected snapshots are inserted into `source_observations`. The hashed unique index on source, data class, symbol, price event time and payload hash, together with `ON CONFLICT DO NOTHING`, suppresses identical snapshots. Repeated polling therefore need not produce another receipt row. `event_time` is the price timestamp; endpoint timing must use `metadata.quoteTimestamp`. `received_at` is the database insert time, not a provider publication attestation.
5. Forecast generation uses a 75-minute lookback, 30-minute horizon and supplemental IEX entry capture. It has no regular-session/horizon-close gate. Consequently forecasts created late in the regular session can require post-regular endpoints. The active v3 binding and inactive v4 proposal are preserved.
6. Existing collector `started_at` is assigned when `recordCollectorReceipt` inserts its completion receipt. It is not the actual request start. This investigation instead uses `audit_events` ingestion payload `startedAt`/`finishedAt`, with audit `created_at` as record time. No historical timestamp is rewritten.

## Attribution and remaining uncertainty

| Candidate explanation | Finding |
| --- | --- |
| Receipt deadline too short | Unsupported: zero late-only endpoints; no deadline change justified. |
| Regular-session timing | Verified context for all 14; not proof that IEX was closed. |
| Collector stopped | Contradicted by three completed starts per missing window, subject to audit authenticity limits. |
| Sampling frequency | Three polls per window existed, but snapshot polling can miss transient quotes. Full exchange coverage and adequate frequency remain unproved. |
| Feed selection and deduplication | Both can remove IEX receipt rows by construction; delayed-SIP rows are observed for all six no-IEX-receipt forecasts. Exact historical discarded responses are unavailable. |
| Provider error, entitlement, liquidity or halt | No recorded Alpaca errors in the matching runs; aggregate logs cannot prove per-symbol feed success, entitlement or quote availability. |
| SQL truncation or retrieval omission | Expanded stored-row export has an overflow sentinel and exact quote/receipt text; results reproduce. No missing endpoint was recovered from the additional feeds. Provider completeness is a different question. |

The defensible explanation is a post-regular-session cohort with stale captured IEX quote times and a storage path that records only changing selected snapshots. The remaining distinction between unchanged IEX replies, unselected IEX replies, and genuinely absent provider quotes cannot be reconstructed from historical aggregate receipts.

Official documentation reviewed November 8:

- [Alpaca snapshots](https://docs.alpaca.markets/us/reference/stocksnapshots-1): latest trade and latest quote are distinct fields; IEX is one feed and delayed-SIP has a 15-minute delay.
- [IEX trading hours](https://www.iex.io/resources/trading/trading-hours-holidays): regular equities hours end at 4 p.m. ET, while post-market continues until 5 p.m. ET. Outside regular hours does not establish exchange closure.

These current documents do not independently certify provider behavior or historical publication at forecast time.

## Proposed diagnostics

`scripts/export-collection-trace.sql` is a read-only single-snapshot example for the explicit original cohort. Both source and audit sentinels are counted before deduplication. Collection coverage bounds apply to run **start** times, with receipts recorded by as-of. The SQL was executed against authorized real records. Copy the returned `export` object to an authorized local JSON file and run:

```
node --import tsx scripts/check-collection-trace.ts authorized-export.json
```

The offline wrapper reuses PR #85/#87 timing classifications and PR #84 nanosecond validation. It correlates only mature, complete missing endpoints with run starts, aggregate attempts, stored alternative feeds, and gaps including window edges. Incomplete collection bounds yield NOT_ASSESSED; malformed, future or conflicting audit records fail closed. Run counts and gap sizes are descriptive, not proof of expected scheduling or cause. Other feeds never enter the frozen-source selector.

Prospective logging adds bounded normalized provider candidates (source, symbol, price/quote timestamps, selection eligibility and winner), actual per-selected-symbol insert/conflict/not-completed status, and actual request start to the existing ingest audit and collector details. It includes no prices, credentials or raw provider payloads. Missing normalized fields remain visible; this is not a raw-response or provider-receipt attestation. It changes no requests, provider choice, observation identity, quote selector or evidence retention rules. A conflict is labeled CONFLICT_NO_INSERT rather than asserting a specific constraint. A mid-loop failure leaves later writes NOT_COMPLETED. These diagnostics only take effect after an explicitly approved release.

This branch disables its own automatic Vercel deployment via `git.deploymentEnabled`; other branches retain their existing configuration. Draft review does not authorize any deployment.

## Compatibility and validation

Stacked on draft PR #87, itself dependent on #85 and #84. No changed file overlaps the inactive PR #81 v4 adapter/selector files. Its exact PostgreSQL receipt-bound retrieval, source identity, overflow sentinel, independent verification and activation=null remain unchanged. Unlike v4, this diagnostic intentionally retrieves late receipts through as-of and other feeds for explanation; neither can be admitted to the outcome calculation. Timing availability does not imply valid prices, protocol conformance, certification or predictive skill.

Seven new tests cover poll-vs-receipt distinctions, alternative-feed isolation, errors, exact window/completeness boundaries, symbol attribution, conflicting/future/malformed audits, persistence dispositions and the price-vs-quote provider-selection gap. Local suite: 426 passing tests; TypeScript passed. The local production build passed. A conflict-free temporary combined tree with PR #81 passed 446 tests and TypeScript; no branch was merged or activated. No merge, deployment, protocol activation, production evidence modification or trading permission change is authorized by this proposal.
