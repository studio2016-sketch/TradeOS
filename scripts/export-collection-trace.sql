-- Read-only, one statement/snapshot. Explicit PR #85 cohort/as-of; no collector invocation.
-- Change bounds/cohort deliberately for other investigations. Never infer feed completeness.
WITH p AS (SELECT '2026-11-08 14:09:21.573014+00'::timestamptz AS as_of),
f AS (
 SELECT id::text,symbol,created_at::text,1800000 AS "horizonMs",source_snapshot
 FROM forecast_ledger,p
 WHERE horizon='30m' AND source_snapshot->'proposedQuoteEntry'->>'status'='CAPTURED_PROPOSAL'
 AND created_at<=p.as_of ORDER BY forecast_ledger.created_at DESC,forecast_ledger.id DESC LIMIT 30
), bounds AS (
 SELECT min(created_at::timestamptz) AS first_forecast,
 min(created_at::timestamptz+interval '30 minutes')-interval '5 minutes' AS run_from,
 max(created_at::timestamptz+interval '45 minutes')+interval '5 minutes' AS run_through FROM f
), o AS (
 SELECT o.id::text,o.symbol,o.source_id AS "sourceId",o.metadata->>'quoteTimestamp' AS "quoteAt",o.received_at::text AS "receivedAt"
 FROM source_observations o,p,bounds b
 WHERE o.data_class='market_snapshot' AND o.symbol IN (SELECT symbol FROM f)
 AND o.received_at>=b.first_forecast AND o.received_at<=p.as_of
 ORDER BY o.received_at,o.id LIMIT 10001
), r AS (
 SELECT a.id::text,a.created_at::text AS "recordedAt",a.payload->>'startedAt' AS "startedAt",a.payload->>'finishedAt' AS "finishedAt",
 a.payload->'watchlist' AS symbols,a.payload->'marketAttempts' AS attempts,a.payload->'errors' AS errors,a.payload->'marketSaved' AS saved
 FROM audit_events a,p,bounds b
 WHERE a.event_type='ingestion_run' AND a.created_at<=p.as_of
 AND (a.payload->>'startedAt')::timestamptz BETWEEN b.run_from AND b.run_through
 ORDER BY a.created_at,a.id LIMIT 1001
)
SELECT jsonb_build_object(
 'timing',jsonb_build_object('asOf',p.as_of::text,'retrievalComplete',(SELECT count(*)<10001 FROM o),
 'forecasts',coalesce((SELECT jsonb_agg(f) FROM f),'[]'::jsonb),'observations',coalesce((SELECT jsonb_agg(o) FROM o),'[]'::jsonb)),
 'collection',jsonb_build_object('from',b.run_from::text,'through',least(b.run_through,p.as_of)::text,
 'retrievalComplete',(SELECT count(*)<1001 FROM r),'runs',coalesce((SELECT jsonb_agg(r) FROM r),'[]'::jsonb))) AS export
FROM p,bounds b;
