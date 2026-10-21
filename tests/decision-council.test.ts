import test from "node:test";import assert from "node:assert/strict";
import {evaluateDecisionCouncil} from "../lib/market/decisionCouncil.ts";
import type {AlignmentResult} from "../lib/alignment/engine.ts";
import type {SupervisoryResult} from "../lib/alignment/supervisors.ts";
const now=Date.parse("2026-10-18T15:00:00Z");
const alignment={symbol:"AAPL",readings:[{id:"a",group:"Momentum",label:"Momentum",weight:1,criticalBuy:false,hardSell:false,state:"aligned",buyScore:93,sellRisk:5,source:"historical",freshness:"observed",note:"" }],availability:100} as AlignmentResult;
const supervisors={buyVeto:false,supervisors:[]} as unknown as SupervisoryResult;
test("Model council cannot authorize execution even with supporting scores",()=>{
 const result=evaluateDecisionCouncil({alignment,supervisors,marketSnapshot:{source:"Alpaca:iex",price:100,timestamp:"2026-10-18T14:59:50Z",quoteTimestamp:"2026-10-18T14:59:50Z"},intradayLastObserved:"2026-10-18T14:55:00Z"},now);
 assert.equal(result.executionAllowed,false);assert.equal(result.estimatedWinProbability,null);
 assert.ok(result.vetoes.some(x=>x.includes("out-of-sample")));
});
test("Stale market observations and supervisor veto force PASS",()=>{
 const sup={...supervisors,buyVeto:true};
 const result=evaluateDecisionCouncil({alignment,supervisors:sup,marketSnapshot:{source:"Alpaca:iex",price:100,timestamp:"2026-10-16T20:00:00Z"},intradayLastObserved:null},now);
 assert.equal(result.recommendation,"PASS");assert.equal(result.dataQuality,"DEGRADED");
 assert.ok(result.vetoes.some(x=>x.includes("supervisory")));
});
