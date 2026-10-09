# TradeOS Institutional Knowledge Layer

## Purpose

TradeOS may use advanced professional trading knowledge when it can be expressed as lawful, testable hypotheses from public, licensed, user-authorized, or otherwise legitimate data.

TradeOS must not use:

- material nonpublic information
- stolen or leaked confidential information
- unauthorized private communications
- market manipulation
- front-running
- deceptive order placement
- circumvention of exchange, broker, or data-provider controls

The goal is to encode professional market knowledge, not illegal informational advantage.

## Architecture

The Institutional Knowledge Layer sits beside the canonical 120 gears.

It does not increase the canonical gear count.

It does not receive execution authority merely because a technique is widely used by professionals.

Each playbook is initially shadow-only and must earn influence through measured outcomes.

Version:

`institutional-lens-v1`

## Initial professional playbooks

### VWAP acceptance / reclaim
Tests whether price is being accepted around or above a session value reference using anchored VWAP, reclaim/hold behavior, and confirmation.

### Breakout acceptance vs trap risk
Tests whether a breakout is being accepted through retest, confirmation, and volume rather than merely crossing a price level.

### Volatility compression to expansion
Studies whether quiet ranges are transitioning into directional expansion with volume and persistent momentum.

### Relative-strength leadership
Measures whether an instrument is leading its sector or peer group rather than simply rising with the market.

### Institutional participation proxy
Uses tape aggression, large-trade participation, and accumulation proxies. These are flow proxies and do not identify investor identity.

### Liquidity and transaction-cost quality
Evaluates spread, quote depth, relative liquidity, tradeability, and options liquidity to distinguish theoretical edge from executable edge.

### Post-event drift / information digestion
Studies whether the market continues to reprice after new information rather than assuming all information is instantly incorporated.

### Cross-asset and breadth confirmation
Looks for agreement or disagreement among breadth, market internals, credit, rates, and sector behavior.

### Options-skew stress
Uses volatility skew and expected-move context as a risk/hedging signal. Skew is not treated as a direct directional vote.

### Chase / mean-reversion risk
Measures how far price is from a sensible entry, trigger, invalidation, and reward/risk geometry.

## Validation

Every observed playbook state is frozen in the audit ledger as:

`institutional_playbook_observed`

Outcomes are later graded as:

`institutional_playbook_outcome`

Grading horizons:

- 1 day
- 5 days
- 20 days

Each outcome records direction-adjusted return and path risk.

No playbook should influence canonical factor weights until it has adequate sample size and passes the promotion rules in ADAPTIVE_INTELLIGENCE.md.

## Interface

Guided mode translates professional concepts into ordinary questions.

Advanced mode may expose:

- playbook name
- score
- direction
- evidence
- caveats
- sample size
- historical hit rate
- average signed return
- horizon-specific performance

Complexity belongs underneath the interface. Evidence and uncertainty remain visible on demand.
