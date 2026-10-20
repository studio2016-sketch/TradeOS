import test from "node:test";
import assert from "node:assert/strict";
import {compareInformationValue} from "../lib/research/information-value.ts";
const rows=Array.from({length:40},(_,i)=>({timestamp:new Date(Date.UTC(2026,0,i+1)).toISOString(),baselineLoss:1,macroLoss:.8,newsLoss:.95,baselineNet:.01,macroNet:.009,newsNet:.008}));
test("loss reductions do not imply trading authorization",()=>{const r=compareInformationValue(rows);assert.ok(r.macro.meanLossImprovement>0);assert.equal(r.approvedForTrading,false)});
test("rejects improperly ordered observations",()=>assert.throws(()=>compareInformationValue([...rows].reverse())));
test("rejects insufficient sample",()=>assert.throws(()=>compareInformationValue(rows.slice(0,2))));
test("rejects missing outcomes",()=>assert.throws(()=>compareInformationValue(rows.map((r,i)=>i===4?{...r,newsLoss:NaN}:r))));
