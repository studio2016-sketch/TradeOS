import {FACTOR_CATALOG,FACTOR_KEYS} from "./acceleration-factors";
import {addedOfficialMacroFactors} from "./official-macro-evidence";

/** Static, code-reviewed dependency map. "candidate" is NOT operational certification. */
const historical=new Set(["sma_5","sma_20","sma_50","sma_200","return_1d","return_5d","intraday_range","dollar_volume","gap_pct","price_acceleration","relative_volume","atr_14","realized_vol_5","realized_vol_20","volatility_regime","vol_of_vol","ema_9","ema_21","macd","macd_signal","adx","breakout_strength","overnight_vol","gap_frequency"]);
const snapshots=new Set(["daily_volume","distance_vwap","bid_ask_spread","spread_bps","quoted_depth","order_imbalance"]);
const intradayActivation=new Set(["return_1m","return_5m","return_15m","return_1h","trade_count","turnover","slippage_estimate"]);
const networkActivation=new Set(["gold","treasury_etf_return","equity_bond_correlation","sector_relative_return","industry_relative_return","sector_breadth"]);
const macro=new Set(["us10y_yield","us2y_yield","yield_curve_slope","fed_policy_rate","high_yield_spread","wti_crude","dxy",...addedOfficialMacroFactors.map(f=>f.factor)]);
const treasuryIssuance=new Set(["treasury_issuance"]);
const inputCostShock=new Set(["input_cost_shock"]);
const sec=new Set(["market_cap","net_margin","revenue_growth","earnings_growth","pe_trailing","price_sales","ev_ebitda","free_cash_flow_yield","return_on_equity","insider_trading"]);
const options=new Set(["implied_vol_atm","iv_rank","iv_skew"]);
const marketwideEvents=new Set(["earnings_date","eps_surprise","revenue_surprise","guidance_change","regulatory_change"]);
const news=new Set(["headline_count","headline_novelty","news_source_diversity","news_sentiment","corroboration","news_price_reaction","event_materiality","analyst_revision","buyback_announcement","geopolitical_risk","policy_announcement","tariff_exposure","sec_filing_catalyst"]);
const invalidLegacy=new Set(["var_95","expected_shortfall","max_drawdown"]);
export type FactorDependency={
 key:string;family:string;sourceClass:string;sourceCandidate:string;
 implementationPath:string|null;collectorPath:string|null;
 mappingState:"code_candidate_unverified"|"no_implementation_identified"|"legacy_semantics_invalid";
 blockers:string[];certified:false
};
export function factorDependencyInventory():FactorDependency[]{
 return FACTOR_CATALOG.map(({key,family})=>{
  let sourceClass="unmapped",sourceCandidate="Not established",implementationPath:string|null=null,collectorPath:string|null=null;
  if(historical.has(key)){sourceClass="completed_daily_bars";sourceCandidate="Alpaca daily history";implementationPath="lib/research/market-factor-engine.ts";collectorPath="app/api/cron/acceleration/route.ts";}
  else if(intradayActivation.has(key)){sourceClass="intraday_market_evidence";sourceCandidate="Alpaca timestamped intraday bars / quote snapshots + SEC shares for turnover";implementationPath="lib/research/intraday-activation-evidence.ts";collectorPath="app/api/cron/intraday-activation/route.ts";}
  else if(networkActivation.has(key)){sourceClass="cross_asset_or_relative_market_history";sourceCandidate="Alpaca completed daily bars on explicit ETF/index proxies";implementationPath="lib/research/network-crossasset-evidence.ts";collectorPath="app/api/cron/network-crossasset/route.ts";}
  else if(snapshots.has(key)){sourceClass="market_snapshot";sourceCandidate="Alpaca IEX / snapshot provider";implementationPath="lib/research/acceleration-collector.ts";collectorPath="app/api/cron/acceleration/route.ts";}
  else if(inputCostShock.has(key)){sourceClass="official_input_cost_series";sourceCandidate="FRED PPIACO / U.S. Bureau of Labor Statistics";implementationPath="lib/research/input-cost-evidence.ts";collectorPath="app/api/cron/macro-evidence/route.ts";}
  else if(treasuryIssuance.has(key)){sourceClass="official_treasury_auctions";sourceCandidate="U.S. Treasury Fiscal Data auctions_query";implementationPath="lib/research/treasury-issuance-evidence.ts";collectorPath="app/api/cron/macro-evidence/route.ts";}
  else if(macro.has(key)){sourceClass="official_macro_series";sourceCandidate="FRED (public series; entitlements not verified)";implementationPath="lib/research/official-macro-evidence.ts";collectorPath="app/api/cron/macro-evidence/route.ts";}
  else if(sec.has(key)){sourceClass="sec_company_facts";sourceCandidate="SEC EDGAR XBRL";implementationPath="lib/research/sec-ratio-evidence.ts";collectorPath="app/api/cron/sec-fundamental-evidence/route.ts";}
  else if(options.has(key)){sourceClass="options_surface";sourceCandidate="Alpaca options feed (entitlements not verified)";implementationPath="app/api/cron/options-evidence/route.ts";collectorPath=implementationPath;}
  else if(marketwideEvents.has(key)){sourceClass="structured_marketwide_news_events";sourceCandidate="Persisted Alpaca/Massive news cache with explicit structured event parsing";implementationPath="lib/research/marketwide-event-evidence.ts";collectorPath="app/api/cron/news-evidence/route.ts";}
  else if(news.has(key)){sourceClass="news_or_sec_catalysts";sourceCandidate="Persisted Alpaca/Massive news cache plus SEC catalysts";implementationPath=key==="sec_filing_catalyst"?"lib/research/acceleration-collector.ts":"lib/research/news-factor-evidence.ts";collectorPath=key==="sec_filing_catalyst"?"app/api/cron/acceleration/route.ts":"app/api/cron/news-evidence/route.ts";}
  else if(family==="portfolio_risk"){sourceClass="portfolio_holdings";sourceCandidate="Authorized synchronized positions and prices";implementationPath=null;collectorPath=null;}
  const blockers=[
   "SOURCE_ENTITLEMENT_UNVERIFIED","CALCULATION_INDEPENDENTLY_UNVERIFIED",
   "POINT_IN_TIME_AND_FRESHNESS_UNVERIFIED","EVIDENCE_PERSISTENCE_UNVERIFIED"
  ];
  if(!implementationPath)blockers.unshift("NO_IMPLEMENTATION_IDENTIFIED");
  if(invalidLegacy.has(key))blockers.unshift("LEGACY_SINGLE_SECURITY_PROXY_NOT_PORTFOLIO_RISK");
  return {key,family,sourceClass,sourceCandidate,implementationPath,collectorPath,
   mappingState:invalidLegacy.has(key)?"legacy_semantics_invalid":implementationPath?"code_candidate_unverified":"no_implementation_identified",
   blockers,certified:false};
 });
}
export function factorDependencySummary(){
 const factors=factorDependencyInventory();
 const count=(state:FactorDependency["mappingState"])=>factors.filter(f=>f.mappingState===state).length;
 return {defined:FACTOR_KEYS.length,codeCandidates:count("code_candidate_unverified"),
  noImplementationIdentified:count("no_implementation_identified"),
  legacySemanticsInvalid:count("legacy_semantics_invalid"),
  families:Object.fromEntries([...new Set(factors.map(f=>f.family))].map(family=>[family,{
   defined:factors.filter(f=>f.family===family).length,
   codeCandidates:factors.filter(f=>f.family===family&&f.mappingState==="code_candidate_unverified").length
  }])),factors,certified:0,approvedForTrading:false};
}
