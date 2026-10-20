import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePointInTimeInformation} from "../lib/research/point-in-time-information.ts";
const rows=Array.from({length:35},(_,i)=>{const d=new Date(Date.UTC(2026,0,i+1,12));return {timestamp:new Date(d.getTime()+60000).toISOString(),decisionTime:d.toISOString(),priceObservedAt:new Date(d.getTime()-5000).toISOString(),macroObservedAt:new Date(d.getTime()-20000).toISOString(),newsObservedAt:new Date(d.getTime()-10000).toISOString(),baselineLoss:.5,macroLoss:.4,newsLoss:.3,baselineNet:.001,macroNet:.002,newsNet:.003};});
test("point-in-time fixture remains research only",()=>{const r=evaluatePointInTimeInformation(rows);assert.equal(r.evaluated,true);assert.equal(r.tradeAuthorized,false)});
test("rejects observations published after decision",()=>{const copy=rows.map(x=>({...x}));copy[8].newsObservedAt=new Date(Date.parse(copy[8].decisionTime)+1000).toISOString();assert.equal(evaluatePointInTimeInformation(copy).evaluated,false)});
test("rejects outcomes preceding decision",()=>{const copy=rows.map(x=>({...x}));copy[3].timestamp=new Date(Date.parse(copy[3].decisionTime)-1000).toISOString();assert.equal(evaluatePointInTimeInformation(copy).evaluated,false)});
