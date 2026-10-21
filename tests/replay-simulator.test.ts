import test from "node:test";import assert from "node:assert/strict";
import {simulateLongAfterDecision} from "../lib/research/replaySimulator.ts";
const b=(t:string,o:number,h:number,l:number,c:number)=>({t,o,h,l,c,v:100});
const start="2026-10-16T15:00:00Z";
const p={symbol:"AAPL",decisionAt:start,startingEquity:10000,riskBudget:100,stopPct:2,targetPct:3,slippageBps:10,commissionPerShare:.01,maxBars:5};
test("A conservative bar executes stop first when stop and target are both touched",()=>{
 const rows=[b("2026-10-16T14:55:00Z",50,200,20,60),b("2026-10-16T15:00:00Z",100,105,97,104)];
 const r=simulateLongAfterDecision(rows,p);
 assert.equal(r.status,"EXECUTED");assert.equal(r.exitReason,"STOP");assert.equal(r.entryAt,start);assert.ok(r.netPnl!<0);
});
test("Unfilled or invalid simulation never fabricates P&L",()=>{
 assert.equal(simulateLongAfterDecision([],p).netPnl,null);
 assert.equal(simulateLongAfterDecision([b(start,100,100,99,99)],{...p,slippageBps:-5}).status,"INVALID_INPUT");
});
test("A gap below stop receives worse fill than stop price",()=>{
 const r=simulateLongAfterDecision([b(start,100,101,99,100),b("2026-10-16T15:05:00Z",90,91,88,89)],p);
 assert.equal(r.exitReason,"STOP");assert.ok(r.exitPrice!<95);
});
