# META share-class evidence and current valuation blocker

## Result of fresh-source investigation — November 7, 2026

The official September 2026 10-Q contains two dimensional DEI cover-page
observations at October 16, 2026: Class A 2,214,472,367 and Class B 341,768,886.
Their arithmetic sum is 2,556,241,253. This is a last-reported common-share
snapshot, not a verified current count or a sum of independently priced classes.

Note 3 states that A/B have identical dividend/liquidation rights and different
voting rights. A price applied to A+B is therefore an explicitly identified
Class A price proxy for common economic interests, not an observed Class B quote.
Weighted-average EPS shares, preferred shares, public float, and unissued Class C
shares must not be included. No generic issuer/class equivalence is inferred.

## Authoritative sources and effective dates

- Reviewed 10-Q: https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm
- Filing index: https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/0001628280-26-066773-index.html
- Current submissions: https://data.sec.gov/submissions/CIK0001326801.json
- October 29 financing 8-K: https://www.sec.gov/Archives/edgar/data/1326801/000119312526438017/d183592d8k.htm
- November 2 definitive information statement: https://www.sec.gov/Archives/edgar/data/1326801/000162828026068935/meta-20261102.htm
- November 5 8-K: https://www.sec.gov/Archives/edgar/data/1326801/000119312526450074/d166273d8k.htm
- November 6 debt prospectus: https://www.sec.gov/Archives/edgar/data/1326801/000119312526450754/d44678d424b5.htm

The submissions API identifies acceptance at 2026-10-22T00:00:08.000Z and filing
date October 22. The index displays the corresponding Eastern acceptance time.
The collector retains the more conservative existing next-day filing cutoff.
Retrieval completion is preserved separately from publication and share instant.

The January 19, 2027 charter effectiveness is a mandatory stop for this policy;
it is not treated as the dividend payment or exchange ex-date. The dividend
record/payment dates require further evidence. Do not simply double the old
share count and apply a split-adjusted A quote: Class C can trade separately.

The later filings disclose preferred issuance, a 40 million Class A forward sale,
a November 4 exercise for a further 6 million, and new debt. Forward-sale contract
notional amounts are NOT proof of newly issued shares: settlement can differ.
No 40/46 million addition or preferred conversion is manufactured here. Current
count and capital-structure reconciliation remains unestablished. This blocks
META ratios in the fresh-source run, even though cover-page extraction succeeds.

## Implementation and rejection rules

`lib/market/sec-share-evidence.ts` intentionally supports one reviewed META
filing. Each collection re-fetches that filing and current submissions. Its exact
SHA-256, CIK, accession, document, form and filing date must match. New filings
need a new reviewed policy rather than a silent fallback to an older snapshot.

The parser requires exactly A/B, a common instant, one stock-class axis, the same
CIK, exact positive integer share units and unscaled infinite precision. It
preserves raw facts, raw contexts, context IDs, per-class counts, URL, accession,
acceptance, retrieval time and full-document SHA-256. The fixture contains exact
unit/context/fact excerpts from the official document; synthetic variants in
unit tests are never observations.

All subsequent issuer filings other than enumerated ownership/144 reports block
pricing pending corporate-action review. This deliberately includes filings that
might prove harmless after review. Failed/truncated submissions, unknown document
content, stale counts (>120 days) and the charter stop date also fail closed.
The current response must still contain the reviewed accession, so pagination
that omits it cannot assert completeness.

Prices must be positive, finite, no later than the request, at most 96 hours old
(a conservative bound accommodating a normal weekend), and after the share filing
day. This is an age ceiling, not an exchange-calendar freshness certification.
Stale stored prices trigger a fresh-source attempt before rejection. Annual
numerators must have valid annual periods, accession and disclosure before price.
CFO/capex must still match period, accession and filing date exactly.

If all share/action conditions eventually pass, this fallback permits only the
existing last-fiscal-year price/sales and annual FCF-yield definitions; those are
not asserted to be TTM. META `pe_trailing` stays blocked until TTM income available
to common is established. META EV/EBITDA stays blocked until debt, cash, preferred
claims and EBITDA periods are reconciled. Other issuers do not gain class fallback.

No persistence schema, immutable historical row, evidence gate, source-time
certification, independent verification, paper-execution policy or live-trading
setting is changed. `backtestEligible:false` remains explicit. Diagnostic receipts
retain extracted observations even when ratios are rejected. A numerical candidate
passing basic persistence validation is not independently certified by this work.

## Reproducible fresh-source check

Download the two official responses with the required identifying SEC User-Agent,
then run (paths must refer to the newly downloaded responses):

```sh
node --import tsx scripts/check-sec-share-evidence.ts /tmp/meta.htm /tmp/meta-sub.json
```

The command is read-only and does not backfill or write production factors.
The November 7 check reported:

- filing SHA-256: `3ffe3ab3ece24f40f3a7662c5bd4167f4bd1750249572add801175d5e7acabb1`
- submissions SHA-256: `4803038a18f27013bf90d2e296b0b73a2f2b918b199f2ed106b57544362ac8b0`
- extracted sum: `2556241253`, instant `2026-10-16`
- ratio eligibility: false, `subsequent_filings_require_corporate_action_review`

A read-only production DB inspection found the latest META SEC collection on
November 5 saved four nonvaluation factors. No newly persisted META valuation
ratio is demonstrated. This branch has not been deployed or used for production
ingestion; its successful fixture calculations are tests, not production evidence.

The remaining work is to independently reconcile the later financing/settlement
and class changes, obtain a supported newer denominator or reviewed roll-forward,
and reproduce a newly persisted ratio from its immutable input bundle. Do not
remove the block merely to increase factor coverage.
