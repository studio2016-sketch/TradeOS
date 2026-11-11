# Missing official-source numbers remain unavailable

Synthetic source responses reproduced three connected defects: an empty BLS series was reported as live with value/previous/change all zero; CFTC rows lacking positioning fields produced zero net positions; the institutional lens converted the resulting missing context into measured scores through `Number(null)`.

This patch preserves the distinction between missing data and an observed zero:

- The shared official-source scalar parser accepts finite decimal numbers and correctly grouped thousands. Null, undefined, blank values, missing markers, booleans, objects, malformed grouping, nondecimal coercions, overflow and nonzero values underflowing to zero remain null.
- CFTC positioning and FINRA share counts require nonnegative safe integers. A FINRA facility aggregate is available only if every contributing row supplies the required count. Empty data, missing facilities' values and overflow do not become zero totals. A short-volume numerator exceeding its total does not yield a plausible percentage.
- BLS empty latest values remain unavailable, genuine zero values remain measured, and unsuccessful BLS responses are degraded. BLS changes and Treasury spreads cannot expose nonfinite computed values.
- Institutional averaging ignores missing/nonfinite values instead of turning them into measured zero scores. In particular, missing CFTC positioning no longer becomes neutral positioning or a bearish cross-asset score. Genuine zero positioning remains a measured neutral input. The overall institutional score is also null when no playbook has a measured score; its existing decision-memory consumer preserves that null.

The response fields remain present. Some fields previously fabricated as numeric zero are now explicitly null. Existing consumers use null-aware rendering. Source rows can still contain partial observations: `live` is not a claim of complete fields, freshness, certified provenance or predictive usefulness.

Tests use mocked provider responses and exercise the downstream institutional lens. No live endpoint, production database, collector or trade is invoked. No historical evidence is rewritten. Research-only and order-disabled safeguards remain unchanged.

This is a numeric/missingness repair, not complete adapter certification. Date/schema validation, request timeouts, dataset error detail, source-health semantics, provenance, licensing and live compatibility require separate work. No publication, deployment, subscription or activation is authorized by this patch.
