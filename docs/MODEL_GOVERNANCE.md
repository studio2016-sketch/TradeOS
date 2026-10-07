# TradeOS Model Governance

TradeOS treats model output as evidence, not authority.

## Promotion ladder
1. Research only
2. Historical backtest
3. Walk-forward validation
4. Shadow mode on live data
5. Simulation-authorized
6. Assisted-live eligible
7. Rule-based automation eligible only after extended validation and explicit approval

## Required metrics
- sample size
- win rate
- expectancy in R
- Brier score / calibration error
- max drawdown
- regime-by-regime performance
- slippage sensitivity
- turnover
- drift score

## Ensemble rules
- correlated models do not count as independent confirmation
- regime fit changes model weight
- recent calibration changes model weight
- a high raw probability with high model disagreement can still produce PASS
- models with insufficient sample size remain in observing state
- model weights may fall automatically; promotion requires evidence, not recency bias

## Human-error controls
- predictions are recorded before outcomes
- outcome labels cannot rewrite original forecasts
- model version is immutable on each forecast
- no outcome-aware feature may enter a historical feature set
- every live assessment must expose source freshness and disagreement
