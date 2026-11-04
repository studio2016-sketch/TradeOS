import test from "node:test";
import assert from "node:assert/strict";
import {alpacaSnapshots,alpacaDelayedSipSnapshots,bestSnapshots} from "../lib/market/live.ts";
import {historicalBars} from "../lib/market/features.ts";

test("market-style duplicate snapshots coalesce and account cooldown also protects candles and fallback feeds",async()=>{
 const env={...process.env},originalFetch=globalThis.fetch;
 try{
  process.env.ALPACA_API_KEY="rate-limit-integration";process.env.ALPACA_API_SECRET="test";process.env.ALPACA_FEED="iex";delete process.env.MASSIVE_API_KEY;
  let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({SPY:{latestTrade:{p:100,t:new Date().toISOString()}}})};
  const [best,raw]=await Promise.all([bestSnapshots(["SPY"]),alpacaSnapshots(["SPY"])]);
  assert.equal(calls,1);assert.equal(best.snapshots[0].timestamp,raw[0].timestamp);assert.equal(best.snapshots[0].price,100);
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:429,headers:{"Retry-After":"60"}})};
  await assert.rejects(alpacaSnapshots(["SPY"]),/HTTP 429/);
  const callsAtLimit=calls;
  await assert.rejects(alpacaDelayedSipSnapshots(["AAPL"]),/HTTP 429/);
  await assert.rejects(historicalBars("AAPL","5Min","2026-11-04T00:00:00Z"),/HTTP 429/);
  const unavailable=await bestSnapshots(["SPY"]);
  assert.deepEqual(unavailable.snapshots,[]);assert.equal(unavailable.provider,null);assert.equal(calls,callsAtLimit);
  assert.ok(unavailable.attempts.some(a=>a.error?.includes("HTTP 429")));
 }finally{
  globalThis.fetch=originalFetch;
  for(const key of ["ALPACA_API_KEY","ALPACA_API_SECRET","ALPACA_FEED","MASSIVE_API_KEY"]){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}
 }
});
