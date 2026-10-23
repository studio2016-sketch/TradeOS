import test from "node:test";
import assert from "node:assert/strict";
import {halfSpreadSlippageBps,returnAtMinutes,sessionTradeCount,turnoverFromVolumeShares} from "../lib/research/intraday-factor-engine.ts";

const bars=Array.from({length:61},(_,i)=>({t:new Date(Date.parse("2026-10-23T13:30:00Z")+i*60_000).toISOString(),c:100+i,n:10,v:1000}));
test("intraday return windows use only bars at or before the terminal observation",()=>{
 assert.equal(returnAtMinutes(bars,1)?.value,160/159-1);
 assert.equal(returnAtMinutes(bars,5)?.value,160/155-1);
 assert.equal(returnAtMinutes(bars,15)?.value,160/145-1);
 assert.ok(Math.abs((returnAtMinutes(bars,60)?.value??0)-.6)<1e-12);
});
test("intraday liquidity helpers fail closed and match independent arithmetic",()=>{
 assert.equal(sessionTradeCount(bars),610);
 assert.equal(sessionTradeCount([...bars.slice(0,50),...bars.slice(50).map(x=>({...x,n:undefined}))]),null);
 assert.equal(turnoverFromVolumeShares(5_000,100_000),.05);
 assert.equal(turnoverFromVolumeShares(5_000,0),null);
 assert.equal(halfSpreadSlippageBps(99,101),100);
 assert.equal(halfSpreadSlippageBps(101,99),null);
});
