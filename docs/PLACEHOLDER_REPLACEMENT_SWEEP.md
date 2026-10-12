# TradeOS Visual and Interaction Sweep — 2026-10-11

## Release principle
Do not fabricate current market visuals, quotes, indicators, earnings catalysts or strategy outcomes. Every current or historical market number should have a traceable source and as-of date. Missing provider access must yield an explicit unavailable state, not an invented replacement.

## Primary screen inventory
- Home: risk/market context is API-derived; added refresh button. Tracked securities are symbol IDs only; removed fake setups, prices, targets, stops and volume.
- Discover: opportunity ranking uses API alignment; no preset stock performance figures. 'Explain measured evidence' and 'Analyze setup' buttons now navigate.
- Analyze: old illustrative entry/support/target line removed; connected daily historical OHLC candlesticks from provider API. Missing bars result in no chart.
- Trade: risk calculator remains paper-only; removed fabricated entry/stop/target defaults; entered price inputs are explicit. Integrated risk and paper execution is accessible in Week One.
- Learn: explicit educational concepts and functioning links. Static teaching examples are instructional, not market observations.
- Replay: removed fake line and inert slider; connected date-ordered historical daily candles and Next candle control. This is visual candle replay, not complete point-in-time strategy simulation.
- Journal: measured forecast counters when available; full durable personal paper ledger remains a separate engineering requirement.
- News: provider/SEC source data and outbound source links; no fabricated recent headline requirement.
- Edge Lab: removed fabricated volatility term-structure bars; displays unavailable until option surface is sufficiently validated. Composite bars and anomaly list require observed evidence.
- Alignment: renders alignment API and explicit research-only authorization; no actual order execution.
- Live-Source Board: 6 symbol cards, refresh, source/age status, observed bid-ask visual, clickable ticker details, research-to-paper diagnostic button.
- Week One: step-progress controls, contextual glossary, synthetic educational chart labeled as such, risk calculator, simulated trade journal and quiz.

## Technical guardrails completed
- /api/assessment no longer inserts fake bullish evidence for missing observations.
- /api/cron/ingest rejects invalid prices/timestamps and does not substitute demonstration market assessments.
- /api/historical-bars serves provider-based daily adjusted bars only. No synthetic OHLCV fallback.
- CI fixture checker rejects known previously problematic static dashboard charts and no-op button tags.

## Outstanding acceptance blockers
1. Browser-driven QA, accessibility and screenshots across iPhone, tablet and desktop are NOT verified by build success.
2. Historical data API entitlement and quote accuracy need runtime response verification under each configured feed.
3. The content still contains static educational guidance and example hypothetical trades, appropriately designated as educational.
4. Full persistent paper portfolio, complete historical strategy replay, live provider entitlement certification and validated predictive edge are NOT complete.
5. Review Vercel/GitHub statuses and complete PR acceptance before merging into production.

## Test matrix
- Open every navigation view at 320, 375, 430, 768, 1024 and 1440px; no horizontal overflow.
- Click every refresh, selector, chart replay control, journal button, assessment link, glossary tab and quiz input.
- Simulate provider 401/403/429/timeouts, missing snapshot, invalid quote timestamps, missing historical bars, holiday/weekend gaps.
- Verify no GUI or API shows a synthetic signal as live; no order writes occur in paper mode.
