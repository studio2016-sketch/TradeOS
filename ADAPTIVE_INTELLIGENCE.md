# TradeOS 120-Gear Adaptive Intelligence Architecture

## Canonical structure

TradeOS uses 120 canonical decision gears:

- 108 market/decision gears
- 12 adaptive-intelligence gears

The 108 market gears measure the opportunity. The 12 adaptive gears measure whether TradeOS should trust its own reasoning about that opportunity.

The adaptive layer may reduce confidence or block escalation. It must not manufacture a stronger recommendation when the underlying market evidence has not earned one.

## 108 market/decision gears

The primary market layer remains grouped into ten assemblies:

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

The v2 extension adds eight distinct measurable factors:

- Credit-stress condition
- Yield-curve condition
- Quote freshness quality
- Options skew condition
- Quote-depth quality
- Catalyst recency
- Buying-power headroom
- Cash-reserve condition

Missing evidence is never treated as favorable.

## 12 adaptive-intelligence gears

1. Regime fit
2. Factor importance confidence
3. Factor interaction strength
4. Evidence independence
5. Historical calibration
6. Sample sufficiency
7. Out-of-sample validation
8. Model drift control
9. Execution realism
10. Uncertainty control
11. Portfolio interaction
12. Counterfactual robustness

Some adaptive gears intentionally remain unavailable until the dataset is mature enough. Unavailable is preferable to false precision.

## Promotion rules

A learned relationship should not gain decision authority merely because it performs well in training data. Promotion should require:

- sufficient resolved observations
- frozen pre-outcome features
- out-of-sample validation
- walk-forward validation
- realistic execution cost assumptions
- performance across more than one regime where applicable
- stability over time
- low enough redundancy with already-promoted evidence
- acceptable calibration
- monitored drift after promotion

No future feature-importance learner should be allowed to promote a factor solely on in-sample correlation.

## Confidence hierarchy

Market evidence is evaluated first.

Supervisory governors may veto or reduce authority.

Adaptive intelligence then determines how much confidence the system should place in the learned interpretation.

A full 120-gear maximum-alignment state requires:

- all 108 market gears observed and aligned
- every critical market gate passed
- all 12 adaptive gears observed and aligned
- no supervisory buy veto
- no global-event buy clamp

This is a TradeOS internal state, not a guarantee of profit.

## Human-facing presentation

Guided mode should not expose the full 120-gear machinery unless requested.

Default surface language should answer:

- What is happening?
- Is this opportunity healthy?
- What could go wrong?
- Can the risk be controlled?
- What should I do next?

Learn as I go may reveal the professional terminology in context.

Advanced mode may expose the complete 108 + 12 architecture, supervisors, calibration, provenance, and detailed diagnostics.

## Versioning

The first canonical 120-gear snapshot version is:

`swiss-movement-v2-120`

Historical 100-gear snapshots remain valid historical records and should not be rewritten.
