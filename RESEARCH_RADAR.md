# TradeOS Research Radar

## Purpose

Research Radar expands TradeOS learning without exposing capital.

It searches for subjects worth studying across:

- historical price behavior
- broad provider news
- U.S. domestic news context
- global news context
- configurable local/regional news terms
- analyst, strategist, economist and portfolio-manager commentary
- commentary associated with major investment/research institutions
- TradeOS's own frozen forecasts and resolved outcomes

Research Radar is not an execution engine.

## Safety boundary

Every Research Radar response and snapshot is shadow research only.

Research observations:

- cannot place orders
- cannot increase position size
- cannot unlock live execution
- cannot bypass the 120-gear alignment engine
- cannot bypass supervisory governors
- cannot turn an interesting theme into a trade recommendation by itself

The execution-eligibility fields must remain false.

## Research universe

The default research universe spans:

- broad U.S. equity indexes
- sector ETFs
- rates and credit
- commodities and dollar proxies
- liquid bellwether equities across technology, financials, energy, health care and industrials

The universe is divided into rotating buckets so broad research can run frequently without overloading data providers.

The schedule is staggered every 15 minutes. With four default buckets, the full default universe is revisited approximately once per hour.

The universe can be overridden with:

`TRADEOS_RESEARCH_UNIVERSE`

The number of buckets can be adjusted with:

`TRADEOS_RESEARCH_BUCKETS`

## Local / regional news

TradeOS always classifies U.S. domestic and global news.

Specific local-region tracking is optional and uses:

`TRADEOS_LOCAL_NEWS_TERMS`

This should contain comma-separated place or regional terms. TradeOS should not silently guess a user's local region.

## Subject discovery

A research subject may be created from:

- unusual historical trend strength or weakness
- unusual novelty
- provider-news concentration
- expert/strategist commentary
- recurring sector or macro themes
- geopolitical themes
- disagreement among evidence streams

Each subject freezes its evidence at observation time.

## Expert lens

Research Radar identifies professional-view language associated with roles such as:

- chief investment officer
- market strategist
- equity strategist
- investment strategist
- portfolio manager
- fund manager
- economist
- analyst
- research director

It also recognizes commentary associated with major investment, brokerage, research and market-infrastructure institutions when present in licensed provider news.

Prestige does not create predictive authority.

Expert views are graded against realized outcomes at:

- 1 day
- 5 days
- 20 days

Source-level hit rates and signed returns are computed only after views mature through those horizons.

## Research thesis grading

Research subjects are graded at:

- 1 day
- 5 days
- 20 days

The resolver records:

- realized return
- direction-adjusted return
- maximum favorable path
- maximum adverse path
- success / failure classification

This allows TradeOS to distinguish:

- fast information
- swing information
- slow structural information
- themes that were directionally right but dangerously timed
- themes that sounded persuasive but had no measurable edge

## Promotion policy

Research Radar findings are hypotheses.

They should not become canonical gears or adaptive-model authority until they survive the governance rules in ADAPTIVE_INTELLIGENCE.md, including:

- adequate sample size
- frozen pre-outcome evidence
- out-of-sample validation
- walk-forward validation
- execution realism
- regime testing
- redundancy testing
- calibration
- drift monitoring

## Persistence

Research Radar uses the existing audit ledger. No schema change is required.

Event types include:

- `research_subject_observed`
- `research_subject_outcome`
- `research_radar_snapshot`
- `expert_view_observed`
- `expert_view_outcome`

Research version:

`research-radar-v1`

Expert lens version:

`expert-lens-v1`
