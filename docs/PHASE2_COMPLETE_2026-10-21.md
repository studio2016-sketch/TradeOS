# TradeOS Phase 2 Complete — Existing Pipeline Repair

Date: 2026-10-21

Phase 2 scope: repair and verify the existing source → collector → persistence/evidence pipelines without weakening point-in-time rules, fabricating missing values, or authorizing trading.

## Verified production results

- Canonical factor registry: 120/120 have explicit source requirements, calculation requirements, cadence, and freshness policy.
- Persisted factor evidence: 63 rows across 27 distinct factors.
- Evidence vintage violations: 0 rows with available_at earlier than observed_at.
- Genuine measured-factor union: 56/120.
  - The union combines non-null acceleration observations with persisted factor evidence.
  - Legacy single-security values labeled var_95, expected_shortfall, and max_drawdown are excluded from this count because they do not constitute portfolio-risk measurements.
- Raw source observations: 8,046 total; the verified Phase 2 ingest added 6 hashed source observations.

## Collector verification

| Collector | Production result |
|---|---|
| FRED macro | finished; 21 received; 21 evidence rows saved |
| SEC fundamentals | finished; 6 received; 6 evidence rows saved; 3 factors for each of 2 issuers |
| News factors | 2 finished runs; 140 news records received; 36 factor evidence rows saved |
| Alpaca options | finished; 2 underlyings checked; 1,000 contracts returned per checked underlying; 0 evidence rows saved because no fresh option quotes were available at the pre-market verification time |
| Acceleration | scheduled route reached production and recorded receipts; pre-market snapshots failed the live-freshness gate, so 0 new acceleration observations were intentionally saved |
| Primary ingest | finished; 70 source/event records received; 6 new hashed market source observations saved; 6 alignments processed; no reported ingest errors |
| Market entitlement audit | finished; 4 feed checks recorded |

## Market-feed findings

The production entitlement audit showed:

- Alpaca IEX: HTTP 200, timestamped data available, but the pre-market sample was the prior session and therefore not fresh.
- Alpaca SIP: HTTP 403; consolidated real-time SIP is not available through the current connected entitlement.
- Alpaca delayed SIP: HTTP 200; timestamped consolidated data available with approximately 15-minute delay.
- Massive stock snapshot: HTTP 403 through the current connected Massive entitlement.

TradeOS therefore no longer assumes that Massive stock snapshots or Alpaca SIP are available. Massive stock snapshot requests are disabled unless explicitly enabled after a future entitlement change. Delayed SIP is used only as a clearly labeled fallback when the primary snapshot is stale; downstream live-factor gates still reject observations that are too old.

## News-pipeline repair

A durable news-ingestion ledger and shared article cache are active for Alpaca News and Massive News.

- Recent cached articles at verification: 88 Alpaca and 32 Massive.
- Cross-instance provider rate budgets prevent every serverless invocation from independently hitting provider limits.
- When a budget is already reserved, callers reuse recently persisted articles rather than issuing another request.
- Provider 429 responses enter a shared cooldown and can fall back to cached articles.
- A recent post-repair window showed successful provider requests plus cache reuse with no failed/rate-limited rows in that window.

## Persistence hardening

- Collector execution receipts are persisted in tradeos_collector_runs.
- Shared evidence validation/persistence is centralized.
- Market source observations now store SHA-256 payload hashes.
- A unique partial index prevents duplicate hashed source observations.
- Oversized SEC and Alpaca responses no longer use the Next.js data cache path that produced 2 MB cache warnings.
- FRED requests now have bounded network timeouts.
- CI now installs locked dependencies, runs all automated tests, and runs a production Next.js build.

## Current scientific status

Phase 2 verifies pipeline execution and persistence, not predictive validity.

- 56/120 factors have genuine measured evidence or eligible stored observations.
- 64/120 remain unmeasured.
- 0/120 are automatically declared scientifically certified by this phase.
- Trading authorization remains false.
- Source restriction, independent calculation validation, freshness validation at decision time, and predictive certification remain later-phase gates.
