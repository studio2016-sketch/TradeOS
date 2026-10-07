# TradeOS Production Runbook

## Current production state
- GitHub is source of truth.
- Vercel is production runtime and scheduler.
- Dedicated Neon project stores evidence, forecasts, outcomes, calibration, model health, source observations and audit events.
- SEC EDGAR is an active authoritative catalyst source.
- FRED is an active official daily regime-context source.
- Massive and Alpaca adapters are implemented but remain inactive until credentials are configured.
- Live execution remains locked.

## Environment variables
### Required core
- DATABASE_URL
- TRADEOS_INGEST_TOKEN
- CRON_SECRET

### Optional market/news providers
- MASSIVE_API_KEY
- ALPACA_API_KEY
- ALPACA_API_SECRET
- ALPACA_FEED (default: delayed_sip)
- MACRO_DATA_API_KEY (reserved for a future licensed event-calendar adapter)
- TRADEOS_WATCHLIST (default: NVDA,AMD,PLTR,SPY,QQQ,IWM)

Secrets must live in Vercel environment variables and never in Git.

## Scheduler
- /api/cron/ingest: every 5 minutes during the broad U.S. premarket/market/after-hours window on weekdays.
- /api/cron/calibrate: once per weekday after the U.S. cash session.

Cron endpoints require CRON_SECRET.

## Evidence hierarchy
1. Direct exchange/SIP observation or official filing/source.
2. Licensed market/news provider.
3. Cross-source corroboration.
4. Deterministic feature calculation.
5. AI interpretation.

AI-generated text never replaces the underlying observation.

## Prediction lifecycle
1. Raw observation is timestamped with provenance.
2. Evidence is normalized with freshness and quality.
3. Independent evidence is fused.
4. Disagreement raises uncertainty.
5. Shadow models may create research forecasts.
6. Forecasts are immutable before outcome.
7. Mature forecasts resolve from later market observations.
8. Calibration and Brier statistics update.
9. Model scorecards monitor sample size, win rate, calibration and drift.
10. Only validated models may be considered for later promotion.

## Hard rules
- No provider data may be labeled live when it is delayed or stale.
- No prediction confidence without an underlying probability definition.
- No model promotion based on in-sample performance alone.
- No cherry-picking or deleting losing forecasts from calibration.
- No autonomous live trading in the current system.
- PASS is preferred to low-quality evidence.
- Missing/stale/conflicting data lowers authority automatically.
- News significance requires market reaction, not headline language alone.

## External activation remaining
The application is functional without paid feeds, but intraday price/volume assessment, catalyst reaction scoring, shadow forecasting and provider news remain dormant until Massive or Alpaca market-data credentials are configured.
