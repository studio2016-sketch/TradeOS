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
test('truncated evaluation horizon remains unresolved instead of realizing partial P&L',()=>{
 const r=simulateLongAfterDecision([b(start,100,101,99,100.5)],p);
 assert.equal(r.status,'INSUFFICIENT_HORIZON');assert.equal(r.exitReason,null);
 for(const value of [r.entryPrice,r.exitPrice,r.grossPnl,r.netPnl,r.fees,r.maxAdversePct,r.maxFavorablePct])assert.equal(value,null);
 assert.equal(r.size,0);assert.match(r.warnings.at(-1)!,/1 of 5/);
});
test('complete requested horizon retains independently calculated P&L',()=>{
 const r=simulateLongAfterDecision([b(start,100,101,99,100),b('2026-10-16T15:05:00Z',100,102,99,101)],{...p,maxBars:2,slippageBps:0,commissionPerShare:0});
 assert.equal(r.status,'EXECUTED');assert.equal(r.exitReason,'HORIZON');
 assert.equal(r.size,50);assert.equal(r.netPnl,50);assert.equal(r.exitPrice,101);
});
test('early target is resolved without waiting for unused horizon bars',()=>{
 const r=simulateLongAfterDecision([b(start,100,104,99,103)],{...p,slippageBps:0,commissionPerShare:0});
 assert.equal(r.status,'EXECUTED');assert.equal(r.exitReason,'TARGET');assert.equal(r.netPnl,150);
});
test('horizon is a positive finite integer and duplicate bars cannot pad it',()=>{
 for(const maxBars of [NaN,Infinity,0,1.5,501])assert.equal(simulateLongAfterDecision([b(start,100,101,99,100)],{...p,maxBars}).status,'INVALID_INPUT');
 const r=simulateLongAfterDecision([b(start,100,101,99,100),b(start,100,101,99,100)],{...p,maxBars:2});
 assert.equal(r.status,'INVALID_INPUT');assert.equal(r.netPnl,null);
});
