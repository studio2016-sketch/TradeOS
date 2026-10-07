# TradeOS Data Architecture

## Objective
Minimize avoidable human and model error by separating raw data ingestion, normalization, evidence generation, assessment, risk, and presentation.

## Source tiers
1. Exchange/SIP or authoritative filing source.
2. Licensed market/news vendor.
3. Secondary confirmation source.
4. AI-derived interpretation.

AI interpretation must never overwrite the raw source record.

## Initial adapters
- Massive: primary U.S. equities SIP trades/quotes/bars.
- Alpaca: secondary equities, options, news, and sandbox.
- SEC EDGAR: authoritative filings/catalysts.
- Cboe: volatility family/term-structure context.
- Macro provider: scheduled releases, consensus, actual, revisions.

## Error controls
- timestamp every observation
- source provenance on every feature
- freshness TTL by data class
- cross-source conflict checks
- automatic factor down-weighting for stale/degraded sources
- no-trade outcome when confidence/data quality is below threshold
- store prediction probability before outcome is known
- calibration by probability bucket
- walk-forward / out-of-sample validation
- strategy drift alarms
- market-regime segmentation
- survivorship-bias-safe historical universes
- corporate-action-adjusted historical data
- transaction cost/slippage assumptions in backtests
- no look-ahead features
- immutable audit records for signal, model version, source timestamps and decision

## Prediction policy
TradeOS predictions are probabilistic assessments, not guarantees. A higher score must be earned by independent, fresh, corroborating evidence. When evidence conflicts, uncertainty rises and position permission falls.
