import test from "node:test";
import assert from "node:assert/strict";
import {calculateMarketFactors} from "../lib/research/market-factor-engine.ts";
const bars=Array.from({length:21},(_,i)=>({timestamp:new Date(Date.UTC(2026,0,i+1)).toISOString(),open:100+i,high:102+i,low:99+i,close:101+i,volume:1000+i*10}));
test("does not invent values without sufficient history",()=>{
 const x=calculateMarketFactors(bars.slice(0,3));
 assert.equal(x.sma_20.value,null);
 assert.equal(x.sma_20.reason,"insufficient_bars");
 assert.equal(x.sma_200.value,null);
});
test("computes deterministic daily indicators",()=>{
 const x=calculateMarketFactors(bars);
 assert.equal(x.sma_5.value,119);
 assert.equal(x.dollar_volume.value,121*1200);
 assert.ok(x.atr_14.value!==null);
 assert.equal(x.sma_200.value,null);
});
test("sorts input by timestamp",()=>{
 assert.deepEqual(calculateMarketFactors([...bars].reverse()),calculateMarketFactors(bars));
});
