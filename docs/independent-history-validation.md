# Strict validation of independent daily history

The Alpaca and Massive daily-history adapters supply the historical source-comparison cron routes. Previously Massive filtered malformed rows out before comparison, and daily dates were paired through a Map that could silently overwrite duplicate dates. A sufficiently large surviving subset could therefore report comparable coverage despite contradictory input. Alpaca also accepted malformed envelope shapes until a generic exception occurred, and both adapters could expose arbitrary exception messages in returned diagnostics.

The adapters now validate the full response before selecting completed dates:

- Require the expected response array and optional matching symbol identity.
- Reject pagination continuation, including invalid pagination field types.
- Require valid, timezone-bearing timestamps, unique UTC dates, finite numeric OHLCV, positive prices, consistent high/low bounds and nonnegative volume.
- Reject an entire source response if any row is invalid, including a current-day row that would otherwise have been filtered out.
- Apply the same completed New York trading-date exclusion and chronological ordering after validation.
- Preserve the explicitly selected Alpaca feed identity through the request and return generic transport errors without exception text.

The comparison validates inputs again and excludes error-bearing sources even if they contain bars. It pairs normalized UTC dates and sorts the result, preventing input order or timezone spelling from hiding duplicate sessions or changing the displayed last 250 pairs. A failed source gives zero overlapping pairs, a null agreement ratio and comparabilityEstablished=false. Existing valid-response schemas and the 20-session minimum remain unchanged.

This is validation of stored/fetched daily-price shapes and coverage, not an exchange-calendar certificate, source-time attestation, adjustment reconciliation, or proof of predictive skill. Raw price adjustment and IEX versus consolidated coverage limitations remain. Volume comparison remains ineligible.

Eight focused tests mock provider HTTP responses and exercise valid data, malformed/duplicate rows, geometry, pagination, envelope identities, completed-day filtering, error-bearing sources and credential-message redaction. No production cron endpoint was invoked, no provider credentials were retrieved, and no production observations were changed during validation. Existing immutable evidence is not repaired or relabeled. The proposal changes future adapter behavior only after an approved merge/deployment.
