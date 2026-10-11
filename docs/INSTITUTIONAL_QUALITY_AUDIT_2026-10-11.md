# TradeOS Institutional Quality Audit — 2026-10-11

Scope: Code inspection of forecasting, outcomes, calibration, provider endpoints, navigation, practice UX. Not an audited trading record.

## Fixes implemented this round
- Immutable outcomes: duplicate settlement writes now return HTTP 409 instead of overwriting results.
- Provider probe protected by the ingestion token; public on-demand diagnostic removed to avoid quota exhaustion and unauthorized API costs.
- Prior fix: missing market source timestamps no longer silently become current timestamp.
- Prior fix: configured market-data providers do not automatically receive a live label.

## Priority 0: Data correctness and anti-leakage
- Attach provenance to each point: source, symbol, exchange scope, observation time, received time, publication time, entitlement, corporate-action adjustment and quality level.
- Distinguish quote timestamps from last-bar timestamps; a midpoint is not necessarily an executed trade.
- Disallow actionable signals with synthetic, invalid, future-dated, stale or missing mandatory data. Fail closed to PASS.
- The Massive free plan must use the supported historical API, not assume paid snapshots are available.
- Freeze model version and feature universe before evaluation. Use point-in-time information, include delisted securities, and timestamp macro-release vintages.
- Use chronological walk-forward splits, untouched holdout periods, realistic bid-ask, fees, slippage, unfilled orders and volatility regime stress tests.
- Report counts, coverage, calibration, Brier skill vs base rate, expectancy net of costs, maximum drawdown, tail-risk, turnover, and uncertainty.
- Track all evaluated forecasts, including passes, non-trades, missing data, losing outcomes and model drift.

## Priority 0: Interpretability and financial safety
- Replace any unconditional MUST BUY/MUST SELL marketing labels with evidence assessment and capital-risk review labels.
- Signal scores are not probabilities unless independently calibrated.
- Enforce max daily loss, per-position and correlated portfolio caps in simulated execution before considering live action.
- No autonomous live trading without an explicit later approval.

## Priority 1: Paper execution realism
- Replace manually entered hypothetical trade exits with ledgered paper orders and dated exchange-consistent fills.
- Record rejected, partial, unfilled, spread, slippage and overnight gap outcomes.
- Use commission, borrowing cost and market impact assumptions with sensitivity analysis.
- Track expectancy in risk units alongside profitability.

## Priority 1: UX
- Five primary entry points: Home, Discover, Understand, Practice, Improve; advanced tools hidden in professional drawer.
- Source identity and as-of badges adjacent to each number/chart.
- Tap glossary explanations and explain the evidence, counterevidence, invalidation and position sizing for each setup.
- Measure reasoning quality rather than gamified trade volume.
- Test 320/375/430px mobile, 768/1024px tablet, 1280/1920px desktop, landscape, keyboard, VoiceOver.

## Priority 1: Operations
- Add upstream request timeouts, caching, retry budgets, rate-limits, circuit breakers and alarms for stale source health.
- Never expose provider secrets or raw error bodies to anonymous users.
- Secure and persist personal journals per authenticated user if moving beyond local-only browser storage.
- Independent deployment/interactive QA required beyond passing builds.

## Promotion gate
No real-money readiness claim until independent point-in-time walk-forward studies show repeatable net-of-cost performance with adequate sample size, calibration, stress performance and uncertainty.

Methodology references: CFA Institute 2026 Backtesting and Simulation; CFA Institute 2026 Trading Costs and Electronic Markets; CFA Research Foundation Investment Model Validation.
