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

test("volatility regime and volatility-of-volatility require enough completed bars",()=>{
 const short=calculateMarketFactors(bars.slice(0,20));
 assert.equal(short.volatility_regime.value,null);
 assert.equal(short.volatility_regime.reason,"insufficient_bars");
 const twentyOne=calculateMarketFactors(bars);
 assert.ok(Number.isFinite(twentyOne.volatility_regime.value));
 assert.equal(twentyOne.vol_of_vol.value,null);
 assert.equal(twentyOne.vol_of_vol.reason,"insufficient_bars");
 const extended=Array.from({length:35},(_,i)=>({
  timestamp:new Date(Date.UTC(2026,0,i+1)).toISOString(),
  open:100+i,high:102+i,low:99+i,close:101+i,volume:1000+i*10
 }));
 const observed=calculateMarketFactors(extended);
 assert.ok(Number.isFinite(observed.vol_of_vol.value));
 assert.ok(observed.vol_of_vol.value>=0);
 assert.equal(observed.vol_of_vol.inputCount,25);
 assert.equal(observed.volatility_regime.inputCount,21);
});
test("flat completed history yields zero vol-of-vol without inventing a regime ratio",()=>{
 const flat=Array.from({length:30},(_,i)=>({
  timestamp:new Date(Date.UTC(2026,0,i+1)).toISOString(),
  open:100,high:100,low:100,close:100,volume:1000
 }));
 const result=calculateMarketFactors(flat);
 assert.equal(result.volatility_regime.value,null);
 assert.equal(result.volatility_regime.reason,"zero_long_window_volatility");
 assert.equal(result.vol_of_vol.value,0);
});
