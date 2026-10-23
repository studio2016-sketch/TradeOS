import {describe,it} from "node:test";
import {strict as assert} from "node:assert";
import {forwardPE,estimateRevision,ivRank,portfolioRiskFactors} from "../lib/research/specialized-factor-calculations";
const t="2026-10-22T20:00:00Z",old="2026-10-21T20:00:00Z",future="2026-10-23T20:00:00Z";
describe("specialized factor guards",()=>{
 it("rejects future analyst data",()=>{assert.equal(forwardPE({value:100,availableAt:t},{value:5,availableAt:old},t),20);assert.equal(forwardPE({value:100,availableAt:t},{value:5,availableAt:future},t),null)});
 it("requires chronological estimate revisions",()=>{assert.equal(estimateRevision({value:2,availableAt:old},{value:3,availableAt:t},t),50)});
 it("requires 252 IV history points",()=>{assert.equal(ivRank({value:1,availableAt:t},[],t),null)});
 it("keeps daily loss budget in currency",()=>{const r=portfolioRiskFactors({equity:10000,availableAt:t,positions:[{symbol:"AAA",sector:"Tech",marketValue:2000}]},t,100,50,500,-100);assert.equal(r?.risk_budget_remaining,400);assert.equal(r?.single_name_weight,20)});
 it("handles zero positions",()=>{assert.equal(portfolioRiskFactors({equity:10000,availableAt:t,positions:[]},t,100,50,500,0)?.portfolio_exposure,0)});
});
