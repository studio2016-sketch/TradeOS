/** Curated expert research archetypes. These are qualitative summaries, NOT audited profitability rankings or endorsements. */
export const expertArchetypes=[
{name:"Paul Tudor Jones",specialty:"Macro turning points and downside control",activate:"Macro shock or crowded trend reversal",counter:"Discretionary timing may not generalize"},
{name:"Stanley Druckenmiller",specialty:"Concentrated conviction with macro/liquidity alignment",activate:"Strong multi-horizon catalyst with favorable liquidity",counter:"Concentration increases tail risk"},
{name:"Bruce Kovner",specialty:"Cross-market confirmation and predefined exits",activate:"Currency/rates/commodities disagree with equity thesis",counter:"Macro causality is uncertain"},
{name:"Ed Seykota",specialty:"Systematic trend following and behavioral discipline",activate:"Persistent directional regime",counter:"Whipsaws in sideways markets"},
{name:"Larry Hite",specialty:"Risk budgets and probabilistic trend systems",activate:"Position sizing and portfolio risk evaluation",counter:"Diversification can fail in a crisis"},
{name:"Richard Dennis",specialty:"Rule-based breakouts and reproducibility",activate:"Range breakout with liquidity",counter:"False breakouts and turnover"},
{name:"Bill Lipschutz",specialty:"FX positioning and correlated exposure management",activate:"Currencies and cross-asset risk concentration",counter:"FX-specific experience may not transfer"},
{name:"Marty Schwartz",specialty:"Short-horizon momentum and quick loss reduction",activate:"Liquid short-term tactical trade",counter:"High turnover costs"},
{name:"Michael Marcus",specialty:"Trend conviction with loss discipline",activate:"Emerging directional opportunity",counter:"Discretionary judgment not reproducible"},
{name:"William O'Neil",specialty:"Growth leadership and price-volume confirmation",activate:"Earnings-led equity breakout",counter:"Momentum crashes and valuation risk"},
{name:"Jim Simons",specialty:"Broad empirical signals and scientific testing",activate:"Large point-in-time dataset and independent replay",counter:"Proprietary implementation cannot be replicated"},
{name:"Cliff Asness",specialty:"Cross-asset factor research and diversification",activate:"Portfolio factor evaluation",counter:"Factor crowding and long drawdowns"},
{name:"David Harding",specialty:"Systematic managed futures and model diversification",activate:"Multi-market trend portfolio",counter:"Prolonged whipsaw regimes"},
{name:"John W. Henry",specialty:"Rules-based long-term trends",activate:"Sustained trend across liquid futures",counter:"Lag and abrupt reversals"},
{name:"George Soros",specialty:"Reflexivity and self-reinforcing price narratives",activate:"Credit bubbles and positioning feedback loops",counter:"Hard-to-falsify narratives"},
{name:"Ray Dalio",specialty:"Economic regimes and balanced risk exposures",activate:"Growth/inflation regime and cross-asset stress",counter:"Regime classification can be unstable"},
{name:"Howard Marks",specialty:"Second-level thinking, cycles and risk premiums",activate:"Late-cycle risk and valuation excesses",counter:"Rare major positioning shifts"},
{name:"Warren Buffett",specialty:"Business quality, valuation and margin of safety",activate:"Long-horizon equity valuation",counter:"Not a short-term trading specialist"},
{name:"David Tepper",specialty:"Distressed assets and policy-driven asymmetry",activate:"Dislocation and policy liquidity inflection",counter:"Deep valuation uncertainty"},
{name:"Linda Bradford Raschke",specialty:"Short-term mean reversion and setup discipline",activate:"Range-bound liquid markets",counter:"Trend continuation against reversal entries"}
] as const;
export const principles=[
{code:"LOSS_BUDGET",description:"Define tolerable loss and exposure before entry",policy:"Hard portfolio and per-trade risk limits; no auto-execution"},
{code:"INVALIDATION",description:"Predefine evidence that invalidates the thesis",policy:"Require time-stamped invalidation criterion"},
{code:"REGIME",description:"Match method to market regime",policy:"Permit abstention; compare trend and reversal challengers"},
{code:"SIZING",description:"Size by volatility, liquidity and correlation",policy:"Check concentrated and common-factor exposure"},
{code:"EVIDENCE",description:"Demand repeatable edge net of costs",policy:"Use point-in-time independent chronological testing"},
{code:"DISCIPLINE",description:"Avoid reactive decisions and hindsight",policy:"Immutable research preregistration"}
] as const;
export const consensusMethod={threshold:17,cohortSize:20,status:"UNVERIFIED",rule:"Count affirmative expert-source support for each narrowly defined principle; unknown is not affirmative; 17 independently supported individuals needed.",promotion:"Consensus generates hypotheses only, never certification or orders."} as const;
