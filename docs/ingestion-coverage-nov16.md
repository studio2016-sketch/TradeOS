# Intraday ingestion and factor coverage repair

Base: `73fd8f084de0615086a11b6c103ba6cc2c2da443` (PR #97). This proposal leaves outcome validation and GUI drafts untouched.

## Confirmed code defects repaired

- Intraday `availableAt` previously used the request start, before awaited market history, SEC extraction and quote lookup. The reconciled November 11 local receipt-time repair samples an actual clock after extraction, rejects invalid/backwards clocks, and records request/completion provenance for newly emitted evidence. All source timestamps and request cutoffs remain unchanged. Conservative common completion time can delay eligibility; it cannot make results eligible before collection finishes.
- Slippage evidence previously substituted `event_time` for an absent or invalid quote timestamp. A market snapshot's event time can describe the last trade, not its bid/ask. Quote evidence now requires a strict, explicit quote clock and numeric finite bid/ask observations. Missing/malformed clocks and coercible nonnumeric prices remain unavailable with diagnostics.
- Static dependency diagnostics previously mapped daily factors to an existing route without explaining its missing schedule. Dependencies on the acceleration route now carry `COLLECTOR_NOT_SCHEDULED`; code presence never establishes operational collection or certification.

## Coverage bottlenecks still open

The parent task supplied a November 16 read-only Neon audit: 120 catalog keys, 106 with non-null evidence, 14 without, and 24 daily technical keys last received October 27. These are supplied audit results, not a new database query by this repair task. Historical presence does not establish fresh, applicable, source-time-certified evidence.

Git commit `5c35a448e92f6467350d969137e1865bb9f0193c` deliberately removed two temporary study schedules after the October 20–26 study. Current `vercel.json` contains no acceleration cron. The route remains callable and its universe logic rolls forward weekly: simply restarting it would reintroduce the broad study, not a narrowly bounded daily refresh. The local November 11 bounded proposal was limited to NVDA/AMD/PLTR, one attempt, and expired before 21:00Z that day. It is neither deployed nor reusable by changing a date. A standing or newly bounded daily collection design, fresh expected-session checks and separate release/execution review remain needed. This patch does not restore any of the 24 keys' freshness or fill the 14 absent keys.

The supplied 22:04 UTC receipt received six candidates, saved five, and rejected slippage for `unsupported_storage_precision`. In current code that reason exclusively denotes nonzero submicrosecond timestamp digits, not numeric slippage precision. Quote metadata can contain nanoseconds while PostgreSQL `timestamptz` preserves microseconds. Synthetic fixtures reproduce rejection and valid-batch continuation. The exact production quote row was not independently fetched here. Do not truncate, round, substitute a trade clock, or relabel receipt time to force acceptance. Lossless nanosecond storage and exact reader/decision-time comparison design remain necessary before those observations can be stored safely; the existing guard is intentionally unchanged.

The 14 absent keys were not individually identified in the supplied audit, so this proposal makes no claim to diagnose every absent source or to fill their evidence. Current main already contains PR #97's official-source missingness/health and FRED fixes, and PR #90's strict news/evidence intake. Old open source drafts should not be reapplied blindly.

## Validation and release boundary

Local full regression suite: 540 tests passed; TypeScript passed. Thirteen added test cases cover asynchronous completion, availability ordering, backwards clocks, partial failures, exact source times, persistence provenance, quote-clock rejection, numeric type rejection, mixed precision batches and the 24 daily dependency diagnostics. Local webpack production build passed with nonsecret placeholder auth configuration. No production provider or database test is implied.

No production collectors, new schedules, migrations, historical updates, secrets changes, subscriptions, orders, certification changes, merges or deployments. The branch's Vercel automatic deployment is disabled in its own configuration. This is a draft for code review; production execution/release remains separate.
