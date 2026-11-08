# Evidence intake and decision-time boundary repair

The central intake gate could accept evidence with an invalid validation clock, bypass domain freshness checks for an unknown domain, and overlook an observation occurring after receipt within the same millisecond. All three defects were reproduced as accepted=true before this change. A null or nonstring attribution field could also throw instead of producing a rejection.

## Supported behavior

`validateEvidence` now validates runtime shape, registered factor, finite numeric value, nonblank string source/subject, one of the five known domains, a valid clock, and strict timezone-bearing timestamps. Own-property domain lookup prevents prototype names from masquerading as domains. The existing factor-specific range checks remain.

`evidenceTimestamp` validates calendar fields and timezone offsets and compares instants using exact integer nanoseconds. It accepts ISO timestamp spelling and PostgreSQL timestamp text with explicit offsets. Impossible dates, local times without a zone, date-only values and unsupported precision are unavailable; they are never normalized into evidence. Equivalent offsets and fractional spellings compare equally.

The intake policy is identified as `tradeos.evidence-intake.v2` in its returned diagnostic. Existing domain freshness limits and the 30-second future-receipt clock allowance are unchanged. That allowance is an intake rule, not permission to use a record at an earlier decision.

The decision-time vintage audit uses the same strict parser, rejects unknown domains and blank attributions, and requires availability at or before the exact supplied decision time. Its most-recent-receipt selection now distinguishes receipts inside a millisecond. No intake grace applies to decision eligibility. Coverage counts remain descriptive and certified=false.

The normal persistence function delegates to an injectable storage boundary using the same SQL insert and validation path. Tests exercise that boundary with a stub tagged-SQL function: invalid candidates produce rejections and zero inserts; valid evidence retains the existing insert-only behavior. Malformed candidates no longer crash rejection reporting. Production still uses the configured database and server clock. No route or authorization bypass is added.

## Verification and limits

Eight new regression tests cover invalid clocks, unknown/prototype domains, malformed runtime fields, calendar/timezone validation, nanosecond receipt reversals, freshness and allowance boundaries, storage rejection, decision-time lookahead and exact latest-receipt selection. Existing option evidence and source-vintage tests remain in place. Full local validation: 404 tests passed, TypeScript passed and production build passed.

These are synthetic validation and persistence-boundary tests. No production SQL write, collector invocation, historical evidence rewrite, certification change or trading permission change occurred. Existing database timestamp precision and original source publication semantics are not established by this parser; preserving nanoseconds in memory does not upgrade database storage precision or certify provenance. Historical records are not relabeled. Source authenticity, correct units, calculation validity and independent scientific certification remain separate requirements.
