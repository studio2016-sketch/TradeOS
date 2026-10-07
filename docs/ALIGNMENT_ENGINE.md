# TradeOS Swiss Movement Alignment Engine

## Purpose
The Alignment Engine evaluates 100 variables across ten assemblies for both opportunity alignment and capital-protection risk.

## Assemblies
1. Market Regime
2. Instrument Quality
3. Multi-Timeframe Trend
4. Momentum
5. Volatility & Risk
6. Volume & Order Flow
7. Setup Quality
8. Timing & Execution
9. Catalyst & Information
10. Discipline & Capital Protection

Each assembly contains ten variables. Missing inputs remain unavailable; they never count as aligned.

## Buy states
- NO TRADE
- WATCH
- READY
- HIGH CONVICTION
- MUST BUY

MUST BUY is a TradeOS state label, not a guarantee. It requires all 100 variables observed and aligned, all critical gates passed, and no hard protective condition active.

## Sell states
- HOLD
- CAUTION
- REDUCE
- EXIT BIAS
- MUST SELL

MUST SELL is a capital-protection state label. A hard protective gate can override aggregate scoring.

## Critical buy gates
Critical gates include broad-market direction, liquidity, spread quality, intraday trend/VWAP, reward-to-risk, loss containment, relative volume, invalidation clarity, chase avoidance, slippage, daily loss status, and stop readiness.

## Hard sell gates
Hard protective gates include spread/liquidity failure, thesis invalidation, loss-containment failure, daily-loss-limit breach, excessive open risk, stop-order failure, and decisive VWAP/thesis breakdown.

## Data policy
Every variable stores:
- source
- freshness
- availability
- weight
- buy score
- sell-risk score
- state
- explanatory note

Unavailable is distinct from neutral.

## Persistence
Scheduled ingestion stores alignment snapshots in audit_events with model version swiss-movement-v1. This permits later analysis of which alignment combinations preceded favorable and unfavorable outcomes.

## Promotion policy
The 100-variable weights are starting governance weights, not permanent truth. They should be refined only after out-of-sample evidence, calibration history, regime analysis, and sufficient sample size demonstrate that a factor or combination has real predictive value.

## Visual policy
Full alignment intentionally produces an extreme green/gold luminous state. Hard capital-protection conditions produce an extreme red/white state. Intermediate states remain visually restrained to reduce alert fatigue.
