# TradeOS Institutional Data Plane — Acceptance Contract

This specification is a gate, not a claim of production certification.

## Observation envelope
Each ingested observation must eventually persist:
- immutable observation id, security master id, corporate-action revision id
- source provider, product/feed, license/entitlement, observation type and units
- exchange event time, provider publish time (if supplied), ingest receipt time, and time of first system availability
- raw payload digest, original source reference, correction/retraction chain, and ingestion code version
- market session, venue/coverage, price kind, explicit validity status
- quality checks, provider disagreement, freshness and gap status

## Data acceptance tests
1. Valid, same-kind, independent consolidated observations with matching event time and <=25 bps disagreement may pass initial *source-agreement* check.
2. Same-family observations never count as two independent feeds.
3. One source, incompatible coverage (IEX vs consolidated), delayed feed, mixed price kinds or excessive event-time skew fail closed.
4. Missing, future-dated, invalid, or stale prices fail closed.
5. A >25-bps mismatch marks the observation disputed; never silently choose a source as certified.
6. Market-closed last prices may be displayed as historical observations but must never be labeled live.
7. A verified source-agreement result must **not** by itself authorize a certified decision or a live order.

## Work still required before institutional claims
- Independent provider license and SIP/OPRA entitlement verification.
- Security-master identifiers and effective-dated listing/renaming/merger events.
- Point-in-time split/dividend adjustments, index membership, financial statement revisions, macro vintages.
- Immutable raw observations and correction lineage persisted in append-only storage with tamper evidence.
- Data SLO dashboards, ingestion retries, gap detection, clock-skew monitors.
- Automated regression tests and separate post-deploy open-session verification.
- Risk engine independence, model approvals, certified factor lineage and historical replay.

## Stage gates
Research input -> source agreement -> entitlement -> security identity -> point-in-time correctness -> research certification -> independent risk authorization.
Every downstream stage is blocked if any required upstream gate is missing. Paper-only until explicit authorization and independent validation.
