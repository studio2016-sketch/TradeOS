import test from "node:test";
import assert from "node:assert/strict";
import {factorDependencyInventory} from "../lib/research/factor-dependency-inventory.ts";

const byKey=new Map(factorDependencyInventory().map(x=>[x.key,x]));

test("Phase 3 activated factor families have explicit implementation paths",()=>{
 for(const key of ["return_1m","return_5m","return_15m","return_1h","trade_count","turnover","slippage_estimate"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/intraday-activation-evidence.ts");
 }
 for(const key of ["gold","treasury_etf_return","equity_bond_correlation","sector_relative_return","industry_relative_return","sector_breadth"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/network-crossasset-evidence.ts");
 }
 for(const key of ["pe_trailing","price_sales","ev_ebitda","free_cash_flow_yield","return_on_equity","insider_trading"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/sec-ratio-evidence.ts");
 }
 for(const key of ["news_sentiment","corroboration","news_price_reaction","event_materiality","analyst_revision","geopolitical_risk","policy_announcement"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/news-factor-evidence.ts");
 }
 for(const key of ["earnings_date","eps_surprise","revenue_surprise","guidance_change","buyback_announcement","customer_event","regulatory_change","tariff_exposure"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/marketwide-event-evidence.ts");
 }
 for(const key of ["implied_vol_atm","iv_rank","iv_skew"]){
  assert.equal(byKey.get(key)?.implementationPath,"app/api/cron/options-evidence/route.ts");
 }
});

test("portfolio-risk factors use the authorized portfolio engine and reject legacy security proxies",()=>{
 for(const key of ["portfolio_exposure","single_name_weight","position_volatility","var_95","expected_shortfall","max_drawdown"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/portfolio-factor-engine.ts");
  assert.equal(byKey.get(key)?.mappingState,"code_candidate_unverified");
 }
});
