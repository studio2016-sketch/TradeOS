# News extraction and evidence persistence integration

This proposal combines the parser/intake changes from draft PRs #83 and #84 with their integration corrections. It does not include or activate the proposed v4 outcome resolver. PR #82's historical-price validation is retained from current main.

## Corrected behavior

- A fractional day such as `March 5.5, 2031` is unavailable, rather than becoming March 5 of the inferred publication year. Ordinary `March 5, 2030, 5 pm` remains usable. Alternative date lists remain unavailable. Parser metadata advances to `tradeos.reported-news-events.v3` only for new extractions.
- The marketwide collector selects `published_at::text`, validates the original calendar/timezone-bearing text, and preserves its precision through candidate construction. Mixed-offset tariff articles are ordered by exact instant, not lexical timestamp text.
- A receipt clock is sampled after the SELECT. Invalid or postreceipt publications are excluded before issuer parsing and aggregate denominators. Extraction availability is stamped after parsing, with `availabilityKind=extraction_completed`; a backwards completion clock fails closed. The receipt clock has JavaScript millisecond resolution, so a higher-resolution source timestamp that cannot be shown to precede it is conservatively unavailable.
- The gate and decision audit compare exact integer nanoseconds. Intake's 30-second future-receipt allowance does not apply to decision eligibility. Domain freshness limits remain unchanged, including news freshness measured from receipt rather than original article age.
- PostgreSQL timestamps preserve microseconds. Persistence rejects either timestamp with nonzero submicrosecond digits as `unsupported_storage_precision` before SQL; trailing zero padding beyond six fractional digits is safe. This can reduce accepted observations from providers supplying finer precision. It deliberately does not round, upgrade storage, or silently claim exact retained nanoseconds.
- New inserts retain caller metadata plus a protected `evidenceIntake` object with intake policy, persistence policy (`tradeos.evidence-persistence.microseconds.v1`) and original timestamp text. Caller-supplied data cannot overwrite that object. Existing immutable evidence is neither changed nor relabeled.

## Executed test design

`tests/news-evidence-integration.test.ts` runs the actual collector and shared persistence implementation with synthetic SQL rows. It checks the parser regressions, malformed financial values, contradictory reports, timestamp preservation, completion ordering, invalid/future publications, tariff denominator isolation, offset ordering, representable precision, exact freshness/decision boundaries, protected metadata, conflict no-ops and SQL failures.

`tests/evidence-postgres-roundtrip.test.ts` uses the pinned development-only PGlite package, an embedded PostgreSQL WASM engine. It executes the actual tagged INSERT via a parameterized adapter against a representative evidence table and uses the repository's news-cache DDL and append-only protection function/triggers. It demonstrates PostgreSQL's submicrosecond tie, verifies that the application rejects it before INSERT, checks microsecond insert/readback and decision-cutoff queries, exercises constraint errors and confirms UPDATE/DELETE rejection. These are isolated synthetic SQL writes, not writes to Neon or production evidence.

The representative evidence schema does not establish deployed production constraints, driver behavior, session settings or permissions. The production Neon HTTP transport remains untested here. The tests use text timestamp readback; consumers converting values to JavaScript Date can still lose precision and must not claim exact historical eligibility from such conversions.

Local validation on the integrated proposal: 444 tests passed, full TypeScript passed, and the production build passed with nonproduction placeholders and no deployment. An isolated compatibility run with pending PR #81 also passed all 464 tests and TypeScript; its code was then removed from this proposal. The 19 new integration/embedded-PostgreSQL checks are included in those totals. No GitHub CI result is implied by local validation.

## Preserved boundaries and remaining limitations

SQL inserts remain individually append-only; the batch is not transactional. A later SQL error propagates and earlier successful inserts remain. Conflict behavior remains `ON CONFLICT DO NOTHING`. No migrations, historical backfills or production endpoint calls are included.

The review branch `fix/news-evidence-integration` is explicitly disabled for automatic Vercel deployments in `vercel.json`. The first published branch commit must already contain this restriction, so opening the draft can run GitHub CI without creating a preview deployment. The restriction is scoped to this branch; it does not change main's deployment configuration. A later merge/release still requires owner approval.

The source article cache remains mutable, and provider timestamp semantics (including existing upstream fallback behavior) are not independently certified. Parser/intake metadata records implementation lineage, not publisher authenticity or scientific correctness. New extraction availability does not prove historical public availability. Narrow template parsing cannot establish comprehensive financial-report interpretation, and publication-based days-to-earnings is not a continuously refreshed countdown.

Independent source/time certification, prospective v4 validation, immutable prediction binding, model-promotion gates and paper-only execution restrictions remain unchanged. No merge, deployment, protocol activation or live-trading authorization is included.
