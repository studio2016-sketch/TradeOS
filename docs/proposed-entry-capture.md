# Forward-only inactive quote capture

New shadow baseline/challenger forecasts retain one identical supplemental `proposedQuoteEntry` object. It records the selected quote's observation ID, symbol, feed, bid/ask, quote time, receipt time, capture cutoff, and declared capture/outcome-proposal fingerprints. The same object is included in immutable features and their existing input fingerprint/checksum. Model probability calculations and model identity are unchanged.

This does not activate the replacement outcome method. The current outcome protocol, resolver, v3 mismatch blocker, scientific gates and existing records remain untouched. Capture failures retain a safe unavailable reason and do not suppress otherwise valid existing shadow forecast generation. No provider requests or historical updates are added.

## Bounded pre-forecast selection

Before either forecast insert, the generator fixes a cutoff and reads source observations received during the preceding five minutes, capped at 1,001 rows. More than 1,000 candidates makes capture unavailable instead of selecting from a truncated set. The query uses receipt time rather than snapshot trade time and does not consult future endpoints.

The policy accepts only `Alpaca:iex`, with matching symbol, finite positive uncrossed bid/ask (locked quotes allowed), and quote time within five minutes of the cutoff and no later than receipt. Known receipt times outside the window are ignored before quote validation. Conflicting IDs or different prices for the same quote timestamp fail closed. Selection is latest quote time at JavaScript millisecond precision, then earliest receipt at that precision, then lexical observation ID. Original timestamp strings are retained without rounding; impossible calendar dates and timezone-free values are rejected. Distinct prices in the same millisecond fail closed as conflicting; no sub-millisecond ordering claim is made. Changing feeds or selection rules requires a new declared capture policy, not a dynamic ranking.

The cutoff and entry are shared by baseline and challenger, but are not substituted for either forecast's true creation timestamp. Every capture has `validatedForForecast:false` and `activated:false`. A slow database operation can make the entry too old by the time a forecast is created. Millisecond comparisons do not prove sub-millisecond chronology. Future integration must resolve that precision limitation and validate quote/receipt/cutoff against each actual forecast creation time using the separately reviewed method, and reject expired entries rather than selecting a replacement retrospectively. No result here claims that check has occurred.

## Limits and next integration step

Captured JSON and hashes are traceable local evidence, not source authentication, proof of exchange publication timing, independent completeness certification, or proof against database alteration. The receipt-window bound is a conservative candidate limit; it does not prove provider coverage. The latest captured IEX quote is not necessarily the latest market quote. Missing or invalid capture cannot be filled in after the forecast.

Next, a separately reviewed versioned resolver can consume an entry only after checking the actual forecast timestamp and persisted snapshot/immutable evidence agreement. That work also needs complete quote-time endpoint retrieval, fixed receipt cutoff, independent readback tests, and explicit activation. Existing v3 cohorts must remain distinct and blocked. This change makes no eligibility, profitability or execution claim.

Tests use synthetic data, including both actual generator insert paths, immutable input hashing, delayed creation, unavailable capture, cutoff boundaries, conflicts and truncation. No production database results are included.

The integration tests mock SQL responses. They do not validate a production query plan, actual database roundtrip precision, persisted readback, or receipt clock accuracy; those remain separate read-only acceptance checks after any approved deployment.
