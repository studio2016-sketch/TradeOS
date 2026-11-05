# Offline IEX regular-schedule comparison

Run `node --import tsx scripts/check-risk-sessions.ts rows.json` on the same local factor-evidence JSON export used by the risk arithmetic checker. This script has no provider/database access and writes no evidence. It validates bundle integrity/outer row binding using the existing checker, then independently compares each leg's dates to IEX's regular schedule within the captured first-to-last date interval.

## Primary evidence and coverage

The source is the official IEX equities [Trading Hours & Holidays](https://www.iex.io/resources/trading/trading-hours-holidays) page. Its 2026 table was captured on November 5, 2026 at 21:54:37.095 UTC and manually transcribed, with separate review. Raw HTML SHA-256: `ed29c1d9ab57fe7562ebc9980452c420569185d3b13dc4d9288d88df59a6ea22`. The source URL is mutable. The hash identifies the captured bytes, not a signed exchange attestation. The full HTML is not bundled in this repository.

2026 full-day closures: January 1, January 19, February 16, April 3, May 25, June 19, July 3, September 7, November 26 and December 25. November 27 and December 24 are early-close sessions and remain required dates. The official page states regular equities trading hours 09:30–16:00 Eastern Time; bar timestamps are mapped to America/New_York calendar dates with timezone-aware formatting. This date-only comparison does not calculate UTC opening/closing timestamps.

The page exposes no publication/revision date. `sourcePublishedAt` remains null, and capture time is not substituted for original publication time. The dated [NYSE/ICE December 23, 2025 release](https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx) corroborates these regular holiday dates but is not a substitute for IEX feed evidence.

## Meaning of results

- `REGULAR_SCHEDULE_MATCH`: no regular-schedule deviation found within the retained endpoints.
- `REGULAR_SCHEDULE_DEVIATION`: missing scheduled dates or unexpected dates, separately listed for each input leg.
- `UNVERIFIED`: unsupported feed, outside the pinned 2026 coverage, missing/corrupt bundle, or failed existing row/implementation checks.

No result certifies actual feed completeness, historical publication timing, external independent replay, prediction or live trading. All related flags remain false. An exchange-open day does not guarantee a qualifying trade/bar for every symbol on IEX. Outages, halts, instrument lifecycle changes and extraordinary closures have not been exhaustively independently verified; a deviation requires investigation, not invented bars or automatic correction.

Comparing each leg to an external date schedule detects an interior date missing from BOTH series, which pairwise matching alone misses. It does not detect missing prefixes/suffixes beyond the retained endpoints, assess freshness, or prove price correctness. We deliberately do not infer request cutoff from completion receipt time: a collection can cross midnight, and the bundle does not retain request start. The production collector and all audit/trading gates are unchanged.

## Observed check and tests

The seven November 5 scheduled collection bundles matched this regular schedule: beta windows August 11–November 4 contain 61 scheduled dates (Labor Day excluded); correlation windows October 7–November 4 contain 21. This is a retrospective comparison against the calendar captured today, not proof of calendar knowledge at past decision time.

Ten tests cover shared missing dates, unexpected weekend substitution, early closes, full holidays, unsupported feed/year, integrity failures, endpoint-only scope, New York timezone mapping, and offline CLI mixed/empty exports. No live provider request or database write is part of these tests or the checker.
