-- TradeOS factor implementation evidence audit (read-only).
-- Run against the intended Neon branch. This does NOT certify implementations
-- or update tradeos_factor_coverage_registry.
WITH evidence AS (
  SELECT factor_key,
         count(*) AS evidence_rows,
         count(*) FILTER (WHERE value IS NOT NULL AND source_name IS NOT NULL
                           AND observed_at IS NOT NULL AND available_at IS NOT NULL) AS complete_rows,
         count(*) FILTER (WHERE available_at < observed_at) AS timing_anomalies,
         count(*) FILTER (WHERE observed_at > now() + interval '5 minutes') AS future_rows,
         max(observed_at) AS latest_observed_at,
         count(DISTINCT source_name) AS distinct_source_labels
  FROM tradeos_factor_evidence
  GROUP BY factor_key
)
SELECT r.factor_key, r.source_name AS registered_source,
       r.calculation_method, r.expected_cadence, r.freshness_seconds,
       r.implementation_status, r.permission_status,
       coalesce(e.evidence_rows,0) AS evidence_rows,
       coalesce(e.complete_rows,0) AS complete_rows,
       coalesce(e.timing_anomalies,0) AS timing_anomalies,
       coalesce(e.future_rows,0) AS future_rows,
       coalesce(e.distinct_source_labels,0) AS distinct_source_labels,
       e.latest_observed_at,
       CASE
         WHEN coalesce(e.evidence_rows,0)=0 THEN 'missing_evidence'
         WHEN e.complete_rows <> e.evidence_rows THEN 'incomplete_evidence'
         WHEN e.timing_anomalies > 0 OR e.future_rows > 0 THEN 'timestamp_anomaly'
         WHEN r.freshness_seconds IS NOT NULL
              AND e.latest_observed_at < now() - make_interval(secs => r.freshness_seconds)
              THEN 'stale_evidence'
         ELSE 'evidence_precheck_passed'
       END AS evidence_precheck,
       'NOT_CERTIFIED: independent calculation tests, source-time provenance and provider permissions required'
         AS certification_result
FROM tradeos_factor_coverage_registry r
LEFT JOIN evidence e USING (factor_key)
ORDER BY evidence_precheck, r.factor_key;
