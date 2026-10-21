# TradeOS Phase 1 — 120-Factor Source and Gap Inventory

**Audit date:** 2026-10-21. **Evidence:** Neon coverage status, repository canonical catalog, code inspection. This is a diagnostic inventory, **not operational certification**.

## Findings
- 120 canonical factors across 12 families, 10 each.
- 36 with at least one populated value; 84 with none.
- 253 acceleration observations across 97 securities; 8,040 raw source observations, all Alpaca IEX market snapshots.
- Central registry currently lacks source, calculation, and freshness mappings; 0 dedicated evidence rows and 0 collector-run receipts at audit time.
- Code candidates below are **not verified as active**, and unknown mappings are left unknown rather than fabricated.
- All 120 require source entitlement checks, calculation tests, timestamp/availability validation, freshness checks, persistence evidence, and independent certification.
- Existing stored single-security values for var_95, expected_shortfall, and max_drawdown do **not** establish portfolio-risk evidence.

## Priority repair sequence
1. Verify production cron execution and deployment of evidence collectors; record authenticated execution receipts and errors (macro, options, SEC, acceleration).
2. Repair factor evidence persistence and join the registry to real source lineage; distinguish observation time from availability time.
3. Map and test already implemented daily-bar, snapshot, macro, SEC and options calculations; backfill metadata only when code and provider identity are demonstrated.
4. Implement or connect remaining unmapped factors by dependency cluster; explicitly require authorized portfolio context for portfolio-risk factors.
5. Independently validate every factor; never promote populated coverage to operational or certified counts automatically.

## Per-factor inventory

| Family | Factor | Populated observations | Identified source / code candidate | Primary evidence gap |
|---|---|---:|---|---|
| price_structure | `return_1m` | 0 | Implementation and source not identified | No populated observations |
| price_structure | `return_5m` | 0 | Implementation and source not identified | No populated observations |
| price_structure | `return_15m` | 0 | Implementation and source not identified | No populated observations |
| price_structure | `return_1h` | 0 | Implementation and source not identified | No populated observations |
| price_structure | `return_1d` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| price_structure | `return_5d` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| price_structure | `gap_pct` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| price_structure | `distance_vwap` | 253 | Alpaca snapshot / acceleration collector | Populated, unverified |
| price_structure | `intraday_range` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| price_structure | `price_acceleration` | 0 | Alpaca daily bars / market-factor-engine | No populated observations |
| trend | `sma_5` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `sma_20` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `sma_50` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `sma_200` | 99 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `ema_9` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `ema_21` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `macd` | 95 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `macd_signal` | 95 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `adx` | 95 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| trend | `breakout_strength` | 95 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| volatility | `realized_vol_5` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| volatility | `realized_vol_20` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| volatility | `atr_14` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| volatility | `overnight_vol` | 32 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| volatility | `implied_vol_atm` | 0 | Alpaca options / options-evidence | No populated observations |
| volatility | `iv_rank` | 0 | Implementation and source not identified | No populated observations |
| volatility | `iv_skew` | 0 | Alpaca options / options-evidence | No populated observations |
| volatility | `vol_of_vol` | 0 | Alpaca daily bars / market-factor-engine | No populated observations |
| volatility | `gap_frequency` | 32 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| volatility | `volatility_regime` | 0 | Alpaca daily bars / market-factor-engine | No populated observations |
| liquidity | `daily_volume` | 253 | Alpaca snapshot / acceleration collector | Populated, unverified |
| liquidity | `relative_volume` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| liquidity | `dollar_volume` | 104 | Alpaca daily bars / market-factor-engine | Populated, unverified |
| liquidity | `bid_ask_spread` | 239 | Alpaca snapshot / acceleration collector | Populated, unverified |
| liquidity | `spread_bps` | 239 | Alpaca snapshot / acceleration collector | Populated, unverified |
| liquidity | `quoted_depth` | 2 | Alpaca snapshot / acceleration collector | Populated, unverified |
| liquidity | `trade_count` | 0 | Implementation and source not identified | No populated observations |
| liquidity | `order_imbalance` | 2 | Alpaca snapshot / acceleration collector | Populated, unverified |
| liquidity | `turnover` | 0 | Implementation and source not identified | No populated observations |
| liquidity | `slippage_estimate` | 0 | Implementation and source not identified | No populated observations |
| equity_fundamentals | `market_cap` | 1 | Implementation and source not identified | Populated, unverified |
| equity_fundamentals | `pe_trailing` | 0 | Implementation and source not identified | No populated observations |
| equity_fundamentals | `pe_forward` | 0 | Implementation and source not identified | No populated observations |
| equity_fundamentals | `price_sales` | 0 | Implementation and source not identified | No populated observations |
| equity_fundamentals | `ev_ebitda` | 0 | Implementation and source not identified | No populated observations |
| equity_fundamentals | `revenue_growth` | 0 | SEC EDGAR / sec-ratio-evidence | No populated observations |
| equity_fundamentals | `earnings_growth` | 0 | SEC EDGAR / sec-ratio-evidence | No populated observations |
| equity_fundamentals | `free_cash_flow_yield` | 0 | Implementation and source not identified | No populated observations |
| equity_fundamentals | `net_margin` | 1 | SEC EDGAR / sec-ratio-evidence | Populated, unverified |
| equity_fundamentals | `return_on_equity` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `earnings_date` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `eps_surprise` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `revenue_surprise` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `guidance_change` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `estimate_revision` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `analyst_revision` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `earnings_call_sentiment` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `insider_trading` | 0 | Implementation and source not identified | No populated observations |
| earnings_events | `sec_filing_catalyst` | 6 | News or SEC / acceleration collector | Populated, unverified |
| earnings_events | `buyback_announcement` | 0 | Implementation and source not identified | No populated observations |
| rates_credit | `fed_policy_rate` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `us2y_yield` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `us10y_yield` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `yield_curve_slope` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `real_yield` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `investment_grade_spread` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `high_yield_spread` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `repo_rate` | 0 | FRED / macro-evidence | No populated observations |
| rates_credit | `treasury_issuance` | 0 | Implementation and source not identified | No populated observations |
| rates_credit | `credit_conditions` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `cpi_yoy` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `core_cpi` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `pce_yoy` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `gdp_growth` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `retail_sales` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `nonfarm_payrolls` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `unemployment` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `jobless_claims` | 0 | FRED / macro-evidence | No populated observations |
| inflation_growth | `pmi_manufacturing` | 0 | Implementation and source not identified | No populated observations |
| inflation_growth | `consumer_confidence` | 0 | FRED / macro-evidence | No populated observations |
| cross_asset | `dxy` | 0 | Implementation and source not identified | No populated observations |
| cross_asset | `eurusd` | 0 | Implementation and source not identified | No populated observations |
| cross_asset | `usdjpy` | 0 | Implementation and source not identified | No populated observations |
| cross_asset | `wti_crude` | 0 | FRED / macro-evidence | No populated observations |
| cross_asset | `natural_gas` | 0 | FRED / macro-evidence | No populated observations |
| cross_asset | `gold` | 0 | Implementation and source not identified | No populated observations |
| cross_asset | `copper` | 0 | Implementation and source not identified | No populated observations |
| cross_asset | `bitcoin` | 0 | Implementation and source not identified | No populated observations |
| cross_asset | `treasury_etf_return` | 0 | Implementation and source not identified | No populated observations |
| cross_asset | `equity_bond_correlation` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `sector_relative_return` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `sector_breadth` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `industry_relative_return` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `supplier_event` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `customer_event` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `competitor_event` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `input_cost_shock` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `capacity_utilization` | 0 | FRED / macro-evidence | No populated observations |
| industry_network | `regulatory_change` | 0 | Implementation and source not identified | No populated observations |
| industry_network | `geographic_exposure` | 0 | Implementation and source not identified | No populated observations |
| news_geopolitics | `headline_count` | 253 | News or SEC / acceleration collector | Populated, unverified |
| news_geopolitics | `headline_novelty` | 16 | News or SEC / acceleration collector | Populated, unverified |
| news_geopolitics | `news_source_diversity` | 32 | News or SEC / acceleration collector | Populated, unverified |
| news_geopolitics | `corroboration` | 0 | Implementation and source not identified | No populated observations |
| news_geopolitics | `news_sentiment` | 0 | Implementation and source not identified | No populated observations |
| news_geopolitics | `event_materiality` | 0 | Implementation and source not identified | No populated observations |
| news_geopolitics | `policy_announcement` | 0 | Implementation and source not identified | No populated observations |
| news_geopolitics | `geopolitical_risk` | 0 | Implementation and source not identified | No populated observations |
| news_geopolitics | `tariff_exposure` | 0 | Implementation and source not identified | No populated observations |
| news_geopolitics | `news_price_reaction` | 0 | Implementation and source not identified | No populated observations |
| portfolio_risk | `beta` | 0 | Implementation and source not identified | No populated observations |
| portfolio_risk | `rolling_correlation` | 0 | Implementation and source not identified | No populated observations |
| portfolio_risk | `portfolio_exposure` | 0 | Implementation and source not identified | No populated observations |
| portfolio_risk | `single_name_weight` | 0 | Implementation and source not identified | No populated observations |
| portfolio_risk | `sector_concentration` | 0 | Implementation and source not identified | No populated observations |
| portfolio_risk | `expected_shortfall` | 17 | Portfolio holdings required; legacy proxy invalid | Populated, unverified |
| portfolio_risk | `max_drawdown` | 17 | Portfolio holdings required; legacy proxy invalid | Populated, unverified |
| portfolio_risk | `var_95` | 17 | Portfolio holdings required; legacy proxy invalid | Populated, unverified |
| portfolio_risk | `position_volatility` | 0 | Implementation and source not identified | No populated observations |
| portfolio_risk | `risk_budget_remaining` | 0 | Implementation and source not identified | No populated observations |

## Completion standard
Every factor is inventoried above. Phase 1 **diagnostic inventory** is complete when this report, the protected audit endpoint, and passing CI are verified; Phase 2 must address missing collector receipts and evidence. **120/120 operational remains a separate milestone.**

## Production cron authorization repair
On 2026-10-21 the production `CRON_SECRET` was found present but empty, which caused every protected Vercel Cron route to fail closed before collector execution. A new non-empty sensitive production secret was installed in Vercel. This commit intentionally triggers a fresh production deployment so the runtime and Vercel Cron scheduler use the repaired credential. Verification remains evidence-based: a successful deployment plus persisted collector receipts is required before declaring cron execution healthy.
