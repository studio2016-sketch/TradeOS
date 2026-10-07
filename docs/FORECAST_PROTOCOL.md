# Forecast Protocol

A TradeOS forecast must be saved before the evaluated horizon begins.

Every forecast records:
- symbol and time horizon
- model/version
- market regime
- direction and probability
- consider/wait/pass decision
- uncertainty, agreement and data-quality scores
- full evidence list
- warnings
- source-state snapshot

The outcome resolver records:
- realized return
- maximum favorable excursion
- maximum adverse excursion
- correctness label
- notes

## Calibration
Probability is not a decoration. A model that emits 80% should be correct approximately 80% of the time under comparable conditions.

TradeOS tracks:
- Brier score
- expected calibration error
- probability bucket reliability
- sample size
- regime-specific reliability
- drift over rolling windows

Poor calibration reduces model weight automatically.

## Anti-self-deception rules
- forecasts are immutable after creation
- outcomes are stored separately
- no deleting losing forecasts from evaluation
- PASS forecasts remain part of the research record
- thresholds are selected on training/walk-forward windows, then frozen for the evaluation window
- costs and slippage are included before deciding whether an edge is useful
