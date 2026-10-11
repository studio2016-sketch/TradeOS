# TradeOS Week One release gate (2026-10-11)

## Delivered in this branch
- Guided seven-day route at /week-one, entered from the TradeOS sidebar.
- Twenty-one checkable lessons, 13 context-sensitive glossary terms, synthetic interactive line chart, knowledge quiz.
- Deterministic paper-only position sizing, manually entered simulated trade outcomes, browser-local journal and process metrics.
- Connectivity truth panel fetches /api/connections and /api/health. This reports configuration and API availability, **not independent upstream data correctness**.
- Global app warns that trade ideas/levels may be illustrative; header no longer broadly claims 'LIVE' without quote freshness verification.
- 320px to desktop adaptive CSS and native browser controls.

## Release blockers and honest status
1. **Live data verification — partial:** Production env includes Alpaca key + secret and Neon DB variables; no Massive key surfaced. A credential's existence is not an upstream end-to-end test. Run signed health/freshness checks and validate quote symbol, vendor, feed, timestamp, delay and exchange entitlement. Mark stale/unavailable visibly and prohibit live-looking recommendation output.
2. **Demo/live separation — partial:** Main page still contains illustrative opportunities and assessment factors. Migrate every displayed dynamic price, score, chart and label to an explicit typed provenance wrapper (`example | delayed | realtime | official | calculated`) with as-of, vendor and calculation metadata. Exclude examples from signal scoring.
3. **Guided Week One — implemented baseline:** educational steps are user-checked, not externally graded.
4. **Navigation — baseline:** visible academy shortcut; comprehensive replacement of legacy ten destinations requires broader UX testing.
5. **Glossary — baseline:** expandable 13-term reference; future per-term tap popovers throughout existing screens.
6. **Chart lesson — synthetic chart available:** replace with authenticated, licensed historical OHLCV before claiming historical replay.
7. **Paper workflow — local illustration only:** no broker orders; fills are user-entered, not simulated against market microstructure. Add server ledger & replay matching with transparent fees/spreads.
8. **Progress scorecard — baseline:** completed checks, knowledge, simulated P/L and self-reported discipline; data persists only in this browser.
9. **Alignment validation — not complete:** run timestamped, out-of-sample walk-forward validation of frozen signals on point-in-time adjusted market data. Include transaction costs, survivorship, benchmark comparison, coverage, calibration, Sharpe/drawdown, all losing outcomes and sample-size gates. No validated edge or predictive reliability claim until then.
10. **Cross-device — build-level only:** Vercel preview compiled successfully. Physical/iOS Safari, Android Chrome, tablet and desktop viewport interaction/accessibility audits are pending.

## Manual acceptance run
- Phone widths 320, 375, 430px; tablet 768, 1024px; desktop 1280, 1920px, portrait + landscape where relevant.
- No horizontal overflow on learning cards, chart, navigation, scorecard, status panel or simulated journal.
- All days selectable, 21 steps independent, progress persists on reload, quiz retries update score.
- Zero or negative inputs blocked, stop>=entry blocked, target<=entry blocked, fractional risk handled, 0-share scenario blocks logging.
- Verify no network POST to broker, paper journal remains within localStorage.
- Quote sources with missing credentials, unavailable provider, stale time, and API failures never show 'real time' or 'verified'.
- Keyboard: all buttons and sliders reachable, focus visible, screen-reader chart description, label and controls read correctly.
- Verify production and preview domains and distinct environment variables; never print secrets in logs.
- Do not merge until live route checks and QA are signed off.
