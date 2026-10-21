import test from "node:test";
import assert from "node:assert/strict";
import {factorDependencyInventory} from "../lib/research/factor-dependency-inventory.ts";

const byKey=new Map(factorDependencyInventory().map(x=>[x.key,x]));

test("Phase 3 activated factor families have explicit implementation paths",()=>{
 for(const key of ["return_1m","return_5m","return_15m","return_1h","trade_count","turnover","slippage_estimate"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/intraday-activation-evidence.ts");
 }
 for(const key of ["treasury_etf_return","equity_bond_correlation","sector_relative_return","industry_relative_return"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/network-crossasset-evidence.ts");
 }
 for(const key of ["pe_trailing","price_sales","free_cash_flow_yield","return_on_equity"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/sec-ratio-evidence.ts");
 }
 for(const key of ["news_sentiment","corroboration","news_price_reaction"]){
  assert.equal(byKey.get(key)?.implementationPath,"lib/research/news-factor-evidence.ts");
 }
});

test("portfolio-risk factors remain fail-closed until real portfolio context exists",()=>{
 for(const key of ["var_95","expected_shortfall","max_drawdown"]){
  assert.equal(byKey.get(key)?.mappingState,"legacy_semantics_invalid");
 }
});
