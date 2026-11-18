import test from "node:test";
import assert from "node:assert/strict";
import {calculatePortfolioRiskFactors} from "../lib/research/portfolio-factor-engine.ts";

test("validated empty holdings measure zero current exposure, not historical risk",()=>{
 const result=calculatePortfolioRiskFactors(10_000,[]);
 assert.deepEqual(result.portfolio_exposure,{value:0,inputCount:0});
 assert.deepEqual(result.single_name_weight,{value:0,inputCount:0});
 for(const key of ["position_volatility","var_95","expected_shortfall","max_drawdown"] as const){
  assert.equal(result[key].value,null);
 }
});
test("invalid equity or rejected positions cannot manufacture empty-account exposure",()=>{
 for(const equity of [0,-1,NaN,Infinity])assert.equal(calculatePortfolioRiskFactors(equity,[]).portfolio_exposure.value,null);
 for(const position of [{symbol:"AAA",marketValue:NaN,returns:{}},{symbol:"",marketValue:100,returns:{}}]){
  assert.equal(calculatePortfolioRiskFactors(10_000,[position]).portfolio_exposure.value,null);
 }
});

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


test("a rejected holding invalidates the whole snapshot rather than understating exposure",()=>{
 const valid={symbol:"AAA",marketValue:4_000,returns:returns(1)};
 const invalid=[{symbol:"",marketValue:6_000,returns:{}},{symbol:"BBB",marketValue:NaN,returns:{}},{symbol:"BBB",marketValue:Infinity,returns:{}},{symbol:"BBB",marketValue:0,returns:{}},{symbol:123,marketValue:6_000,returns:{}},{symbol:"BBB",marketValue:6_000,returns:null},{symbol:"BBB",marketValue:6_000,returns:[]},null];
 for(const position of invalid){
  for(const snapshot of [[valid,position],[position,valid]]){
   const result=calculatePortfolioRiskFactors(10_000,snapshot as any);
   for(const factor of Object.values(result)){assert.equal(factor.value,null);assert.equal(factor.reason,"portfolio_unavailable");}
  }
 }
});
test("duplicate symbols cannot split concentration or manufacture offsetting holdings",()=>{
 for(const marketValue of [3_000,-4_000]){
  const result=calculatePortfolioRiskFactors(10_000,[{symbol:"AAA",marketValue:4_000,returns:returns(1)},{symbol:"AAA",marketValue,returns:returns(1)}]);
  assert.ok(Object.values(result).every(factor=>factor.value===null));
 }
});
test("valid signed holdings preserve gross exposure, concentration and input immutability",()=>{
 const positions=[{symbol:"AAA",marketValue:4_000,returns:returns(1)},{symbol:"BBB",marketValue:-2_000,returns:returns(.5)}];
 const before=JSON.stringify(positions),result=calculatePortfolioRiskFactors(10_000,positions);
 assert.ok(Math.abs(result.portfolio_exposure.value!-.6)<1e-12);assert.equal(result.single_name_weight.value,.4);
 assert.equal(result.portfolio_exposure.inputCount,2);
 assert.ok(Object.values(result).every(factor=>factor.value!==null));assert.equal(JSON.stringify(positions),before);
});
test("malformed runtime snapshots cannot be mistaken for empty holdings",()=>{
 for(const snapshot of [null,undefined,{}, {length:0},"",[null]]){
  const result=calculatePortfolioRiskFactors(10_000,snapshot as any);
  assert.ok(Object.values(result).every(factor=>factor.value===null));
 }
});
