import test from "node:test";
import assert from "node:assert/strict";
import {calculatePortfolioRiskFactors} from "../lib/research/portfolio-factor-engine.ts";

const returns=(scale:number)=>Object.fromEntries(Array.from({length:40},(_,i)=>[`2026-08-${String(i%28+1).padStart(2,"0")}`,scale*((i%7)-3)/100]));
test("portfolio risk factors use synchronized current-weight returns",()=>{
 const result=calculatePortfolioRiskFactors(10_000,[{symbol:"AAA",marketValue:4_000,returns:returns(1)},{symbol:"BBB",marketValue:2_000,returns:returns(.5)}]);
 assert.ok(Math.abs((result.portfolio_exposure.value??0)-.6)<1e-12);
 assert.equal(result.single_name_weight.value,.4);
 for(const key of ["position_volatility","var_95","expected_shortfall","max_drawdown"] as const){assert.ok(result[key].value!==null);assert.ok(result[key].value!>=0);}
});
test("portfolio history factors fail closed without synchronized depth",()=>{
 const result=calculatePortfolioRiskFactors(10_000,[{symbol:"AAA",marketValue:4_000,returns:{"2026-10-20":.01}}]);
 assert.equal(result.portfolio_exposure.value,.4);
 assert.equal(result.var_95.value,null);
 assert.equal(result.var_95.reason,"insufficient_synchronized_returns");
 assert.equal(calculatePortfolioRiskFactors(0,[]).portfolio_exposure.value,null);
});
