# Missing endpoint receipt and regular-session context

This diagnostic extends PR #85 and depends on its PR #84 timestamp parser. It does not change the selector, forecast creation, receipt grace, protocol activation or certification. The timing diagnostic policy is separately identified as `tradeos.quote-receipt-diagnostics.v2`.

## Two separate questions

For mature, complete forecasts with NO_CAPTURED_ENDPOINT, inspect same-symbol/frozen-feed receipts during the unchanged horizon-through-deadline interval:

- PRE_HORIZON_QUOTES_ONLY: at least one matching receipt arrived in the window, but the supplied quote timestamps all predate the horizon. A new receipt does not make an old quote an eligible endpoint.
- NO_MATCHING_RECEIPTS: no matching stored receipt was found during that window. This does not establish that a collector did not run, that a provider failed, or that the exchange was closed. Deduplication, provider selection and storage behavior may also matter.
- NOT_ASSESSED: the forecast is pending, incomplete, unverified, or has another timing disposition. An absence conclusion is not fabricated.

Counts and the latest quote timestamp received during the window are reported without looking at prices or returns. Existing top-level on-time/late-only/missing timing classifications and denominators remain unchanged.

Separately, `iexRegularWindow` compares the horizon/deadline interval against the repository's pinned 2026 IEX regular calendar. Results are FULL, PARTIAL, BOUNDARY_ONLY, NONE, or UNKNOWN. The comparison handles New York DST, holidays and pinned early closes. Cross-local-day windows, invalid intervals and unpinned years remain unknown. Exact nanosecond comparisons prevent a window one nanosecond after the close from acquiring artificial regular time.

## Schedule evidence and limits

Official source reviewed November 8, 2026: https://www.iex.io/resources/trading/trading-hours-holidays

The official page lists equities regular hours of 9:30 a.m.–4 p.m. ET and post-market hours of 4–5 p.m. ET. Its marked 2026 early closes are November 27 and December 24, with a 1 p.m. ET close. The new comparison reuses the existing `IEX_2026_REGULAR_SCHEDULE` transcription rather than overwriting its earlier capture/provenance metadata.

**Outside the regular session does not mean IEX is closed or a valid quote was impossible.** Extended-session feed behavior, symbol liquidity, halts, actual collector execution and source completeness are not established. The current webpage is not proof of the calendar publication available at historical forecast creation. No post-market extension or source entitlement is assumed.

## Reproduction against the existing real sample

Reused the unchanged authorized export from PR #85: 30 forecasts, 150 observation rows, as-of `2026-11-08 14:09:21.573014+00`. No new collector or production write was invoked.

| Timing observation | Forecast count |
| --- | ---: |
| On-time endpoint timing | 16 |
| Late-only | 0 |
| No captured endpoint | 14 |
| Missing, with pre-horizon quotes received during the endpoint window | 8 |
| Missing, without matching receipts during that window | 6 |
| Missing, with endpoint window wholly outside pinned regular hours | 14 |

All 14 missing horizons were after the November 6 regular close at 21:00 UTC. They include baseline/challenger pairs and are not 14 independent market experiments. Eight had continued receipts carrying pre-horizon quote timestamps; six lacked matching receipts during their window. The earlier separate Python inspection matched this 8/6 split. These facts narrow investigation but do not prove the missing-data cause or support changing historical outcomes.

Six new synthetic regression tests cover DST, holidays, early closes, exact close boundaries, unknown/cross-day windows, pre-horizon versus absent receipts, and pending/incomplete safeguards. Existing nine receipt-diagnostic tests remain. The same CLI continues to run offline:

```
node --import tsx scripts/check-receipt-delays.ts authorized-export.json
```

A prospective forecast-session policy would require separate review, explicit approval, source/clock evidence at forecast creation, and versioned cohort rules. This diagnostic neither applies such a policy nor removes inconvenient forecasts from reports. Raw exports remain outside the repository.
