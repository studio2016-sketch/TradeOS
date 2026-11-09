# News extraction and evidence persistence integration

This proposal combines the parser/intake changes from draft PRs #83 and #84 with their integration corrections. It does not include or activate the proposed v4 outcome resolver. PR #82's historical-price validation is retained from current main.

The parallel watchlist producer and cached-news reader are covered by the follow-up in `watchlist-news-evidence-boundaries.md`, including exact publication windows, completion availability, issuer ambiguity, numerical weight failures and reaction measurement chronology.

The upstream HTTP adapters are covered by `provider-news-intake.md`: missing source clocks are no longer replaced with server time, and malformed or cache-unsafe source inputs are rejected with explicit ingestion diagnostics before they reach the article cache.

The completed-interval reaction estimator and strict bounded history retrieval are covered by `news-reaction-validation.md`. New reaction metadata distinguishes nominal completed interval ends from bar start labels and retains the prices/times needed to reproduce the descriptive arithmetic.

## Corrected behavior

- A fractional day such as `March 5.5, 2031` is unavailable, rather than becoming March 5 of the inferred publication year. Ordinary `March 5, 2030, 5 pm` remains usable. Alternative date lists remain unavailable. Parser metadata advances to `tradeos.reported-news-events.v3` only for new extractions.
- The marketwide collector selects `published_at::text`, validates the original calendar/timezone-bearing text, and preserves its precision through candidate construction. Mixed-offset tariff articles are ordered by exact instant, not lexical timestamp text.
- A receipt clock is sampled after the SELECT. Invalid or postreceipt publications are excluded before issuer parsing and aggregate denominators. Extraction availability is stamped after parsing, with `availabilityKind=extraction_completed`; a backwards completion clock fails closed. The receipt clock has JavaScript millisecond resolution, so a higher-resolution source timestamp that cannot be shown to precede it is conservatively unavailable.
- The gate and decision audit compare exact integer nanoseconds. Intake's 30-second future-receipt allowance does not apply to decision eligibility. Domain freshness limits remain unchanged, including news freshness measured from receipt rather than original article age.
- PostgreSQL timestamps preserve microseconds. Persistence rejects either timestamp with nonzero submicrosecond digits as `unsupported_storage_precision` before SQL; trailing zero padding beyond six fractional digits is safe. This can reduce accepted observations from providers supplying finer precision. It deliberately does not round, upgrade storage, or silently claim exact retained nanoseconds.
- New inserts retain caller metadata plus a protected `evidenceIntake` object with intake policy, persistence policy (`tradeos.evidence-persistence.microseconds.v1`) and original timestamp text. Caller-supplied data cannot overwrite that object. Existing immutable evidence is neither changed nor relabeled.

## Executed test design

`tests/news-evidence-integration.test.ts` runs the actual collector and shared persistence implementation with synthetic SQL rows. It checks the parser regressions, malformed financial values, contradictory reports, timestamp preservation, completion ordering, invalid/future publications, tariff denominator isolation, offset ordering, representable precision, exact freshness/decision boundaries, protected metadata, conflict no-ops and SQL failures.

`tests/evidence-postgres-roundtrip.test.ts` uses the pinned development-only PGlite package, an embedded PostgreSQL WASM engine. It executes the actual tagged INSERT via a parameterized adapter against an evidence table matching the read-only production column/unique-key audit, with an extra explicitly synthetic batch-failure constraint. It uses the repository's news-cache DDL and append-only protection function/triggers. It demonstrates PostgreSQL's submicrosecond tie, verifies that the application rejects it before INSERT, checks microsecond insert/readback and decision-cutoff queries, exercises constraint errors and confirms UPDATE/DELETE rejection. It also verifies the proposed chronology constraint without rewriting historical synthetic rows.

The follow-up on November 8 inspected production schema/session metadata read-only and executed the actual pinned Neon HTTP driver against temporary tables on the existing staging branch. Text timestamp readback preserved microseconds; native timestamp readback returned JavaScript Date objects. Production INSERTs, deployed-route behavior, production write permissions and provider authenticity remain untested. See `neon-evidence-transport-verification.md` for the executed scope, safeguards and remaining limits.

Local validation after the completed-interval reaction follow-up: 485 tests passed, full TypeScript passed, and the production build passed with nonproduction placeholders and no deployment. An isolated compatibility run with pending PR #81 (`c26f94c`) also passed all 505 tests and TypeScript; its code was then removed from this proposal. The reaction follow-up adds twelve test groups, including mocked calls through the real history reader and a shared-snapshot concurrency check. The earlier actual staging HTTP audit passed separately for the marketwide/persistence path; the new reaction/provider/watchlist tests use deterministic providers and SQL. No GitHub CI result is implied by local validation.

## Preserved boundaries and remaining limitations

SQL inserts remain individually append-only; the batch is not transactional. A later SQL error propagates and earlier successful inserts remain. Conflict behavior remains `ON CONFLICT DO NOTHING`. The migration `20261108_factor_evidence_vintage_order.sql` is an unapplied proposal: `CHECK (observed_at <= available_at) NOT VALID` would protect future inserts without scanning or changing historical rows. No persistent-database migration, historical backfill or production endpoint call was executed. Applying the migration requires explicit owner approval.

The review branch `fix/news-evidence-integration` is explicitly disabled for automatic Vercel deployments in `vercel.json`. The first published branch commit must already contain this restriction, so opening the draft can run GitHub CI without creating a preview deployment. The restriction is scoped to this branch; it does not change main's deployment configuration. A later merge/release still requires owner approval.

The source article cache remains mutable, and provider timestamp semantics (including existing upstream fallback behavior) are not independently certified. Parser/intake metadata records implementation lineage, not publisher authenticity or scientific correctness. New extraction availability does not prove historical public availability. Narrow template parsing cannot establish comprehensive financial-report interpretation, and publication-based days-to-earnings is not a continuously refreshed countdown.

Independent source/time certification, prospective v4 validation, immutable prediction binding, model-promotion gates and paper-only execution restrictions remain unchanged. No merge, deployment, protocol activation or live-trading authorization is included.
