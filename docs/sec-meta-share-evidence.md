# META last-reported-share valuation evidence

## November 7 result

The reviewed September 2026 10-Q contains exactly two cover-page DEI observations
at October 16: Class A 2,214,472,367 and Class B 341,768,886, totaling
2,556,241,253. Note 3 establishes equal dividend/liquidation rights. A quoted
Class A price applied to A+B is an explicit common-economic-interest proxy;
it is not an observed Class B market quote or a verified exact current count.

Fresh SEC captures and TradeOS's Alpaca delayed SIP observation ($612, trade time
2026-11-07T00:59:34.164304169Z) produce these research candidates:

| Factor | Definition | Value |
| --- | --- | --- |
| price_sales | A price × last-reported basic A+B / last fiscal-year revenue | 7.784499103510046 |
| free_cash_flow_yield | Same annual CFO minus absolute capex / that reported-share equity proxy | 0.029473549564053552 |

A separate Python Decimal calculation reproduces both within 1e-14 relative
engineering tolerance (observed errors below 1e-16). This verifies arithmetic,
not independent provider verification or scientific certification. Both candidates
pass the unchanged basic evidence gate; `backtestEligible:false`,
`currentSharesVerified:false`, and `scientificallyCertified:false` remain explicit.

These factors use last-fiscal-year numerators, not TTM. META trailing PE remains
blocked until TTM income available to common is verified. EV/EBITDA remains
blocked until preferred claims, updated debt/cash and EBITDA periods are aligned.
The delayed SIP trade is age-eligible for this weekend research calculation;
it remains stale under intraday decision checks and cannot authorize a trade.
Massive's connected snapshot entitlement is unavailable; this observation is Alpaca.

## Corporate-action reconciliation

The initial blanket block treated every subsequent issuer filing as unresolved.
The versioned `lib/market/meta-capital-review.json` now records 19 separately
identified subsequent documents, their form, primary document, SEC acceptance,
filing date, full raw SHA-256, canonical URL and scoped disposition.

| Disclosed event | Denominator treatment |
| --- | --- |
| October common forward offering | The October 29 8-K confirms 40 million initially borrowed from existing holders. Contract notional is not newly issued common stock. |
| November 4 additional 6 million option | Additional forward agreements, not proof of issuer delivery or settlement. No 6 million addition is made. |
| Preferred depositary issuance/registration | Excluded from basic common shares; not treated as converted common. Preferred economics prevent unlocking unsupported earnings/EV measures. |
| USD/euro senior-note offerings | Not common-share issuance; debt/cash bridge still blocks EV/EBITDA. |
| Shelf registration and offering/pricing materials | Authorize or describe transactions, not a new outstanding-common count. |
| Class C charter/dividend and plan materials | No Class C is added; January 19, 2027 is a hard policy stop, not an assumed payment/ex-date. |

This review permits the explicitly defined **last-reported basic-share research
basis**. It does not establish that the exact current common count is unchanged,
prove no early forward settlement, or reconstruct all RSU/repurchase/conversion
activity. No count is rolled forward or manufactured. New unreviewed issuer
filings, changes to reviewed bytes or metadata, and unknown effective actions
block use until reviewed. Existing source-time and certification gates are unchanged.

## Collection and rejection rules

The fallback supports one reviewed issuer/10-Q. Each collection verifies the
filing's exact hash, CIK, accession, form, primary document and filing day against
current submissions. The parser requires exactly A/B, the same instant and CIK,
one stock-class axis, positive safe-integer shares, share units, zero scale and
infinite precision. Raw facts and contexts remain in the evidence bundle.

Subsequent material documents are re-fetched in batches of three and checked
against their reviewed digests. Matching accession alone cannot clear review.
Missing/malformed submissions, missing reviewed accession, document fetch failure,
unknown subsequent forms/documents, mismatched identity/digest or the charter
cutoff reject calculations. Ownership/144 reports are not counted as issuer issuance.

A source price must be finite/positive, at most 96 hours old (including an ordinary
weekend), no later than the request and after the share disclosure day. Share
snapshots older than 120 days are rejected. This age ceiling is not exchange
realtime certification. Numerators need valid annual periods, accession and
publication before price; CFO/capex must match start/end/accession/filing day.

Metadata preserves class components, source URLs, acceptance, filing day, share
instant, source/retrieval timestamps, raw hashes, review dispositions, market
snapshot/price kind/coverage, companyfacts hash and exact numerical inputs.
Persistence remains append-only through the unchanged evidence-validation rules.
No historical availability is inferred from a fresh retrieval.

## Reproduction

Download the official 10-Q, current submissions, companyfacts and ticker map,
all 19 review documents at manifest URLs, and a current TradeOS market response.
Preserve raw bytes and capture timestamps. Then run:

```sh
node --import tsx scripts/check-sec-share-evidence.ts /tmp/meta.htm /tmp/meta-sub.json /tmp/meta-review
node --import tsx scripts/audit-meta-valuation.mjs /tmp/meta-valuation-inputs /tmp/meta-candidates.json
```

The audit directory contains `meta.htm`, `meta-sub.json`, `meta-facts.json`,
`sec-tickers.json`, `meta-market.json`, and `review/<accession>` files.
The audit is read-only, uses the production selector/calculator/evidence gate,
requires captures no older than one hour, and marks results
`fresh_source_capture_replay`. It does not replace actual source-time certification.
No synthetic fixture is persisted as an observation. The production collector
continues its normal direct-source collection path.

## Primary sources

- https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm
- https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/0001628280-26-066773-index.html
- https://data.sec.gov/submissions/CIK0001326801.json
- https://www.sec.gov/Archives/edgar/data/1326801/000119312526438017/d183592d8k.htm
- https://www.sec.gov/Archives/edgar/data/1326801/000119312526450074/d166273d8k.htm
- https://www.sec.gov/Archives/edgar/data/1326801/000162828026068935/meta-20261102.htm
- Other canonical source URLs and digests appear in the review manifest.

The index's Eastern acceptance corresponds to 2026-10-22T00:00:08.000Z in
submissions. The existing conservative next-day filing cutoff is retained.
There are no source-time certification, independent verification, trading-gate,
execution-policy or immutable-history relaxations in this change.
