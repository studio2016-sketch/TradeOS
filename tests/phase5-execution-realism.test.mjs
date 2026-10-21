import test from "node:test";
import assert from "node:assert/strict";
import {evaluateExecutionCostResearch,validateFillSlippage} from "../lib/research/phase5-execution-realism.ts";

test("spread-adjusted research cost subtracts a full quoted round-trip spread",()=>{
 const rows=Array.from({length:240},(_,i)=>({
  time:new Date(Date.UTC(2026,9,1+Math.floor(i/12),13,i%60)).toISOString(),
  direction:"bullish",realizedReturn:.003,spreadFraction:.0004
 }));
 const out=evaluateExecutionCostResearch(rows);
 assert.equal(out.samples,240);
 assert.ok(out.sessions>=20);
 assert.ok(Math.abs((out.meanNetAfterQuotedSpread??0)-.0026)<1e-12);
 assert.equal(out.executionSlippageValidated,false);
 assert.ok((out.lowerBound??0)>0);
});
test("fill slippage requires enough fills across independent sessions",()=>{
 const rows=Array.from({length:30},(_,i)=>({
  time:new Date(Date.UTC(2026,9,1+Math.floor(i/6),14,i%60)).toISOString(),
  side:i%2?"buy":"sell",fillPrice:100.01,referenceBid:100,referenceAsk:100.02,quantity:10
 }));
 assert.equal(validateFillSlippage(rows).validated,true);
 assert.equal(validateFillSlippage(rows.slice(0,20)).validated,false);
});
