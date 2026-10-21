-- TradeOS 120-factor gap audit. READ ONLY. Run against TradeOS Neon.
-- A populated factor is NOT certified or necessarily fresh.
-- Audit 1: coverage and missing provenance.
SELECT COUNT(*) AS defined,
 COUNT(*) FILTER (WHERE COALESCE(s.populated_count,0)>0) AS ever_populated,
 COUNT(*) FILTER (WHERE COALESCE(s.populated_count,0)=0) AS never_populated,
 COUNT(*) FILTER (WHERE r.source_name IS NULL OR trim(r.source_name)='') AS source_unmapped,
 COUNT(*) FILTER (WHERE r.calculation_method IS NULL OR trim(r.calculation_method)='') AS calculation_unmapped,
 COUNT(*) FILTER (WHERE r.expected_cadence IS NULL OR r.freshness_seconds IS NULL) AS freshness_policy_missing,
 COUNT(*) FILTER (WHERE r.implementation_status='unverified') AS implementation_unverified,
 COUNT(*) FILTER (WHERE r.permission_status='unknown') AS permission_unknown,
 COUNT(*) FILTER (WHERE s.last_populated_at IS NOT NULL AND r.freshness_seconds IS NOT NULL AND s.last_populated_at + make_interval(secs=>r.freshness_seconds)<now()) AS known_stale
FROM tradeos_factor_coverage_registry r
LEFT JOIN tradeos_factor_coverage_status s USING(factor_key);

-- Audit 2: actionable per-factor gap inventory (no false "working" classification).
SELECT r.factor_key, COALESCE(s.populated_count,0) AS populated_count,
 s.last_populated_at, r.source_name, r.calculation_method,
 r.expected_cadence, r.freshness_seconds,
 r.implementation_status, r.permission_status,
 CASE
 WHEN COALESCE(s.populated_count,0)=0 THEN 'NO_POPULATED_OBSERVATIONS'
 WHEN r.source_name IS NULL OR r.calculation_method IS NULL THEN 'PROVENANCE_OR_METHOD_UNMAPPED'
 WHEN r.freshness_seconds IS NULL THEN 'FRESHNESS_POLICY_UNDEFINED'
 WHEN s.last_populated_at + make_interval(secs=>r.freshness_seconds)<now() THEN 'STALE'
 WHEN r.implementation_status<>'verified' OR r.permission_status<>'verified' THEN 'NOT_VERIFIED'
 ELSE 'CANDIDATE_REQUIRES_INDEPENDENT_VALIDATION' END AS primary_gap
FROM tradeos_factor_coverage_registry r
LEFT JOIN tradeos_factor_coverage_status s USING(factor_key)
ORDER BY (COALESCE(s.populated_count,0)=0) DESC, r.factor_key;

-- Audit 3: collector execution receipts, if available.
SELECT collector,status,count(*) AS runs,max(started_at) AS last_run,
 sum(received) AS received,sum(saved) AS saved
FROM tradeos_collector_runs
GROUP BY collector,status ORDER BY last_run DESC;

-- Audit 4: immutable evidence pipeline completeness.
SELECT count(*) AS evidence_rows,count(DISTINCT factor_key) AS evidenced_factors,
 count(*) FILTER(WHERE available_at<observed_at) AS availability_before_observation
FROM tradeos_factor_evidence;
