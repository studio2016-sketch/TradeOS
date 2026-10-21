import test from "node:test";
import assert from "node:assert/strict";
import {calculateMarketFactors} from "../lib/research/market-factor-engine.ts";
test("constant market bars yield deterministic moving averages, no returns",()=>{
 const bars=Array.from({length:220},(_,i)=>({timestamp:new Date(Date.UTC(2025,0,1+i)).toISOString(),open:50,high:51,low:49,close:50,volume:100}));
 const result=calculateMarketFactors(bars);
 for(const key of ["sma_5","sma_20","sma_50","sma_200"])assert.equal(result[key].value,50);
 for(const key of ["return_1d","return_5d"])assert.equal(result[key].value,0);
 assert.equal(result.dollar_volume.value,5000);
 assert.equal(result.atr_14.value,2);
});
test("incomplete history cannot invent long moving average",()=>{
 const bar={timestamp:"2025-01-01T00:00:00.000Z",open:10,high:11,low:9,close:10,volume:100};
 assert.equal(calculateMarketFactors([bar]).sma_200.value,null);
});

test("three completed daily bars measure acceleration without using future bars",()=>{
 const closes=[100,110,132];const bars=closes.map((close,i)=>({timestamp:new Date(Date.UTC(2026,0,2+i)).toISOString(),open:close,high:close+1,low:close-1,close,volume:100}));
 const out=calculateMarketFactors(bars);
 assert.ok(Math.abs(out.price_acceleration.value-0.1)<1e-12);
 assert.equal(calculateMarketFactors(bars.slice(0,2)).price_acceleration.value,null);
});
