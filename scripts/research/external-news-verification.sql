-- Read-only readiness audit for independent news verification.
-- Counts identifiers that could be resolved externally; DOES NOT certify them.
-- External provider retrieval must independently confirm article identity,
-- ticker association, publication time, and availability before certification.
WITH rows AS (
 SELECT factor_key, subject, observed_at, available_at, value,
        source_metadata->'articleIds' AS ids
 FROM tradeos_factor_evidence
 WHERE factor_key IN ('headline_count','headline_novelty','news_source_diversity','corroboration')
), expanded AS (
 SELECT r.factor_key, r.subject, r.observed_at, r.available_at,
        id.value #>> '{}' AS article_ref
 FROM rows r CROSS JOIN LATERAL jsonb_array_elements(
   CASE WHEN jsonb_typeof(r.ids)='array' THEN r.ids ELSE '[]'::jsonb END
 ) id
)
SELECT factor_key,
       count(*) AS referenced_article_occurrences,
       count(DISTINCT article_ref) AS distinct_article_refs,
       count(*) FILTER (WHERE article_ref LIKE 'alpaca:%') AS alpaca_refs,
       count(*) FILTER (WHERE article_ref LIKE 'massive:%') AS massive_refs,
       count(*) FILTER (WHERE article_ref NOT LIKE 'alpaca:%' AND article_ref NOT LIKE 'massive:%') AS unknown_refs,
       'PENDING_EXTERNAL_PROVIDER_MATCH'::text AS certification_status
FROM expanded GROUP BY factor_key ORDER BY factor_key;
