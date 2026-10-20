export const factorFamilies={
price_structure:["return_1m","return_5m","return_15m","return_1h","return_1d","return_5d","gap_pct","distance_vwap","intraday_range","price_acceleration"],
trend:["sma_5","sma_20","sma_50","sma_200","ema_9","ema_21","macd","macd_signal","adx","breakout_strength"],
volatility:["realized_vol_5","realized_vol_20","atr_14","overnight_vol","implied_vol_atm","iv_rank","iv_skew","vol_of_vol","gap_frequency","volatility_regime"],
liquidity:["daily_volume","relative_volume","dollar_volume","bid_ask_spread","spread_bps","quoted_depth","trade_count","order_imbalance","turnover","slippage_estimate"],
equity_fundamentals:["market_cap","pe_trailing","pe_forward","price_sales","ev_ebitda","revenue_growth","earnings_growth","free_cash_flow_yield","net_margin","return_on_equity"],
earnings_events:["earnings_date","eps_surprise","revenue_surprise","guidance_change","estimate_revision","analyst_revision","earnings_call_sentiment","insider_trading","sec_filing_catalyst","buyback_announcement"],
rates_credit:["fed_policy_rate","us2y_yield","us10y_yield","yield_curve_slope","real_yield","investment_grade_spread","high_yield_spread","repo_rate","treasury_issuance","credit_conditions"],
inflation_growth:["cpi_yoy","core_cpi","pce_yoy","gdp_growth","retail_sales","nonfarm_payrolls","unemployment","jobless_claims","pmi_manufacturing","consumer_confidence"],
cross_asset:["dxy","eurusd","usdjpy","wti_crude","natural_gas","gold","copper","bitcoin","treasury_etf_return","equity_bond_correlation"],
industry_network:["sector_relative_return","sector_breadth","industry_relative_return","supplier_event","customer_event","competitor_event","input_cost_shock","capacity_utilization","regulatory_change","geographic_exposure"],
news_geopolitics:["headline_count","headline_novelty","news_source_diversity","corroboration","news_sentiment","event_materiality","policy_announcement","geopolitical_risk","tariff_exposure","news_price_reaction"],
portfolio_risk:["beta","rolling_correlation","portfolio_exposure","single_name_weight","sector_concentration","expected_shortfall","max_drawdown","var_95","position_volatility","risk_budget_remaining"]
} as const;
export const FACTOR_CATALOG=Object.entries(factorFamilies).flatMap(([family,names])=>names.map((key)=>({family,key})));
if(FACTOR_CATALOG.length!==120)throw Error("Catalog must contain 120 declared factors");
export const FACTOR_KEYS=FACTOR_CATALOG.map(x=>x.key);
export function observedFactorCoverage(features:Record<string,number|null>){
 const observed=FACTOR_KEYS.filter(k=>Number.isFinite(features[k]));
 return {defined:120,observed:observed.length,missing:FACTOR_KEYS.filter(k=>!Number.isFinite(features[k])),coveragePct:Math.round(observed.length/120*1000)/10};
}
