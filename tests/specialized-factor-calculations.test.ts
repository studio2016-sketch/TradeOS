import {describe,it,expect} from "vitest";
import {forwardPE,estimateRevision,ivRank,portfolioRiskFactors} from "../lib/research/specialized-factor-calculations";
const t="2026-10-22T20:00:00Z",old="2026-10-21T20:00:00Z",future="2026-10-23T20:00:00Z";
describe("specialized factor guards",()=>{
 it("rejects future analyst data",()=>{expect(forwardPE({value:100,availableAt:t},{value:5,availableAt:old},t)).toBe(20);expect(forwardPE({value:100,availableAt:t},{value:5,availableAt:future},t)).toBeNull()});
 it("requires chronological estimate revisions",()=>{expect(estimateRevision({value:2,availableAt:old},{value:3,availableAt:t},t)).toBe(50)});
 it("requires 252 IV history points",()=>{expect(ivRank({value:1,availableAt:t},[],t)).toBeNull()});
 it("keeps daily loss budget in currency",()=>{const r=portfolioRiskFactors({equity:10000,availableAt:t,positions:[{symbol:"AAA",sector:"Tech",marketValue:2000}]},t,100,50,500,-100);expect(r?.risk_budget_remaining).toBe(400);expect(r?.single_name_weight).toBe(20)});
 it("handles zero positions",()=>{expect(portfolioRiskFactors({equity:10000,availableAt:t,positions:[]},t,100,50,500,0)?.portfolio_exposure).toBe(0)});
});