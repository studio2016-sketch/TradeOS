# Failed official-source responses are not decision-grade

A synthetic FINRA response marked `degraded`, dated today and containing no measured numeric values was previously classified as `runtimeVerified: true`, `freshness: live`, reliability 87.8 and `decisionGrade: true`. Recent payload timestamps overrode unsuccessful source status and inflated verified/decision-grade source counts. The alignment route uses that count as part of a multi-source readiness condition.

The official-source branch now requires the exact successful status `live` before it evaluates payload-derived freshness. Degraded and unknown/malformed statuses remain unverified with unknown freshness, regardless of date or partial values. Unconfigured responses retain unconfigured freshness. Failed sources cannot enter verified or decision-grade counts. A later successful response can recover normally, and a later failure removes eligibility again.

The configured/connected flag remains separate from current usable observations. Provider authority, source coverage weights, market-provider handling, successful-response freshness behavior, thresholds and trading restrictions are unchanged. A degraded response may retain diagnostic payloads and an error note without receiving usable-source credit.

Eight local test groups cover all official source IDs, recent/stale/future timestamps on failed responses, partial data, unknown statuses, malformed failure payloads, absent/unconfigured data, failure/recovery transitions, stale successful sources and multi-source counts beside a usable market probe. Tests do not call a provider or production database.

This narrow classification repair does not validate the completeness of a response marked live, source accuracy, future timestamps on successful responses, provider licensing, knowledge-graph coverage, scientific certification or trading eligibility. Those require separate source-specific checks. No historical record, production setting or subscription is changed. No publication, merge, deployment or activation is authorized by this patch.
