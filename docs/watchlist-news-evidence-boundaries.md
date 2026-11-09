# Watchlist news evidence boundaries

The news-evidence route combines marketwide article extraction with a second watchlist collector. Fixing only the marketwide collector left the watchlist path with early availability stamps, Date.parse normalization/truncation, lexical timestamp ordering and ambiguous company-event attribution.

Synthetic runs against the preceding implementation reproduced an impossible February 30 article contributing a headline count, a two-issuer article creating guidance observations for both issuers, and NaN source weights becoming a neutral sentiment value of zero. These are reproductions of code behavior, not claims about stored production observations.

## Corrections

- The watchlist analysis window remains anchored to the explicit request time. News publication timestamps must pass the strict calendar/timezone parser and fall within the exact inclusive trailing 24-hour window. A postcutoff or stale article is excluded before aggregate numerators and denominators, including differences inside one millisecond.
- Input receipts and final extraction availability use an injectable completion clock. All candidates receive final availability after asynchronous news/reaction work completes; a backwards completion clock aborts extraction. Request/window end and completion time are distinct diagnostics. New metadata identifies `tradeos.watchlist-news-evidence.v2` and `availabilityKind=extraction_completed`.
- Company-specific analyst, guidance, buyback and regulatory observations require a single-issuer article. Multi-issuer articles remain usable for clearly labeled descriptive headline/exposure measures.
- Latest event selection compares exact instants, including offsets and microseconds. The shared cached-news reader selects timestamp text and converts its spelling to ISO without converting through Date, preserving fractional digits for API consumers. Invalid cache timestamps are unavailable.
- Invalid numerical source weights cannot silently become neutral sentiment or analyst evidence. Descriptive counts remain available when their inputs are otherwise valid.
- News-reaction context now exposes the timestamp of its final return-input bar. Persisted reaction/materiality evidence uses this measurement timestamp, retaining the article timestamp separately. Missing/malformed timestamps, issuer mismatch, measurement before publication, measurement after receipt, and intervals beyond 120 minutes are unavailable. A reaction generated after the request cutoff can be recorded only with its later completion availability; it cannot enter an earlier decision.

## Verification and limits

`tests/watchlist-news-evidence.test.ts` exercises the actual collector with deterministic providers/clocks and the shared persistence/audit boundary. Ten tests cover completion availability, invalid calendars, exact window boundaries, aggregate contamination, offset ordering, issuer ambiguity, reaction chronology, malformed weights, backwards clocks and cache-to-ISO timestamp preservation. No real provider, broker, production collector or production evidence write is used.

Final local validation passed all 456 tests, TypeScript and the production build. A temporary compatibility run with pending PR #81 at `c26f94c` passed 476 tests and TypeScript; the inactive v4 code was then removed from this proposal. Check remote CI on the final PR head rather than carrying forward results from an earlier commit.

The later completed-interval reaction repair is documented in `news-reaction-validation.md`. It changes new reaction results to method v2, records nominal interval ends and input prices, and reuses the watchlist news snapshot for bounded concurrent lookups. These changes do not independently certify source authenticity, article-cache immutability, legacy timestamp fallbacks, financial language interpretation or predictive value. Nominal bar completion is not independent proof of source finality or exact receipt/vintage. Historical evidence is unchanged, the database constraint remains unapplied, and no outcome protocol or trading permission is activated.
