import test from "node:test";import assert from "node:assert/strict";import {alpacaSnapshots,massiveSnapshots} from "../lib/market/live.ts";
test("Alpaca bar-close timestamps cannot be replaced by newer quote timestamps",async()=>{
 const oldKey=process.env.ALPACA_API_KEY,oldSecret=process.env.ALPACA_API_SECRET,oldFeed=process.env.ALPACA_FEED,oldFetch=globalThis.fetch;
 try{
  process.env.ALPACA_API_KEY="test";process.env.ALPACA_API_SECRET="test";process.env.ALPACA_FEED="iex";
  globalThis.fetch=(async()=>new Response(JSON.stringify({AAPL:{latestQuote:{t:"2026-10-18T12:00:00Z",bp:151,ap:152},dailyBar:{t:"2026-10-16T19:55:00Z",c:150,v:12}}}),{status:200})) as typeof fetch;
  const [s]=await alpacaSnapshots(["AAPL"]);
  assert.equal(s.price,150);
  assert.equal(s.timestamp,"2026-10-16T19:55:00Z");
  assert.equal(s.quoteTimestamp,"2026-10-18T12:00:00Z");
  assert.equal(s.priceKind,"day_close");
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.ALPACA_API_KEY;else process.env.ALPACA_API_KEY=oldKey;if(oldSecret===undefined)delete process.env.ALPACA_API_SECRET;else process.env.ALPACA_API_SECRET=oldSecret;if(oldFeed===undefined)delete process.env.ALPACA_FEED;else process.env.ALPACA_FEED=oldFeed}
});
test("Massive last trade price uses last trade's timestamp, not aggregate updated timestamp",async()=>{
 const oldKey=process.env.MASSIVE_API_KEY,oldFetch=globalThis.fetch;
 try{
  process.env.MASSIVE_API_KEY="test";
  globalThis.fetch=(async()=>new Response(JSON.stringify({tickers:[{ticker:"NVDA",updated:1792320000000,lastTrade:{p:99,t:1792233600000},min:{c:101,t:1792319700000},lastQuote:{p:98,P:100,t:1792320000000}}]}),{status:200})) as typeof fetch;
  const [s]=await massiveSnapshots(["NVDA"]);
  assert.equal(s.price,99);assert.equal(s.timestamp,new Date(1792233600000).toISOString());assert.equal(s.priceKind,"last_trade");
 }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.MASSIVE_API_KEY;else process.env.MASSIVE_API_KEY=oldKey}
});
