import test from "node:test";
import assert from "node:assert/strict";
import {createAlpacaDataFetch} from "../lib/market/alpaca-data-fetch.ts";
const url=(path="snapshots?symbols=SPY&feed=iex")=>new URL("https://data.alpaca.markets/v2/stocks/"+path);
const options=(key="test",secret="secret")=>({headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret}});

test("concurrent identical GETs share transport but have independently readable bodies; successes are not cached",async()=>{
 let calls=0;let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const client=createAlpacaDataFetch(async()=>{calls++;await gate;return Response.json({timestamp:"2026-11-04T19:00:00Z"})});
 const requests=[client(url(),options()),client(url(),options())];assert.equal(calls,1);release();
 const bodies=await Promise.all((await Promise.all(requests)).map(r=>r.json()));assert.deepEqual(bodies,[{timestamp:"2026-11-04T19:00:00Z"},{timestamp:"2026-11-04T19:00:00Z"}]);
 await client(url(),options());assert.equal(calls,2);
});
test("Retry-After blocks every feed and endpoint for the same credentials, then recovers",async()=>{
 let time=1_800_000_000_000,calls=0;
 const client=createAlpacaDataFetch(async()=>{calls++;return calls===1?new Response("limited",{status:429,headers:{"Retry-After":"45"}}):Response.json({ok:true})},()=>time);
 assert.equal((await client(url(),options())).status,429);
 const blocked=await client(url("AAPL/bars?feed=sip"),options());assert.equal(blocked.status,429);assert.equal(calls,1);assert.equal(blocked.headers.get("Retry-After"),"45");assert.equal(blocked.headers.get("X-TradeOS-Rate-Limit-Source"),"local-cooldown");
 time+=44_999;assert.equal((await client(url(),options())).status,429);assert.equal(calls,1);
 time++;assert.equal((await client(url(),options())).status,200);assert.equal(calls,2);
});
test("HTTP-date Retry-After and epoch reset use the later future deadline",async()=>{
 let time=1_800_000_000_000,calls=0;
 const client=createAlpacaDataFetch(async()=>{calls++;return new Response(null,{status:429,headers:{"Retry-After":new Date(time+20_000).toUTCString(),"X-RateLimit-Reset":String((time+60_000)/1000)}})},()=>time);
 await client(url(),options());time+=30_000;const r=await client(url(),options());assert.equal(r.headers.get("Retry-After"),"30");assert.equal(calls,1);
});
test("missing, invalid, and expired reset headers use a bounded 30-second fallback",async()=>{
 for(const headers of [{},{"Retry-After":"broken","X-RateLimit-Reset":"NaN"},{"Retry-After":"0","X-RateLimit-Reset":"1"}]){
  let time=1_800_000_000_000,calls=0;
  const client=createAlpacaDataFetch(async()=>{calls++;return new Response(null,{status:429,headers})},()=>time);
  await client(url(),options());assert.equal((await client(url(),options())).headers.get("Retry-After"),"30");assert.equal(calls,1);time+=30_000;await client(url(),options());assert.equal(calls,2);
 }
});
test("credentials and URLs stay isolated and no non-429 errors are cached",async()=>{
 let calls=0;const client=createAlpacaDataFetch(async()=>{calls++;return new Response(null,{status:429,headers:{"Retry-After":"30"}})});
 await client(url(),options());await client(url(),options("other"));await client(url(),options("test","rotated"));assert.equal(calls,3);
 let errors=0;const failing=createAlpacaDataFetch(async()=>{errors++;if(errors===1)throw Error("network failed");return new Response(null,{status:503})});
 await assert.rejects(failing(url(),options()),/network failed/);await failing(url(),options());await failing(url(),options());assert.equal(errors,3);
 let distinct=0;const independent=createAlpacaDataFetch(async()=>{distinct++;return Response.json({})});
 await Promise.all([independent(url(),options()),independent(url("AAPL/bars"),options())]);assert.equal(distinct,2);
});
test("market data wrapper rejects trading hosts and writes without transport",async()=>{
 let calls=0;const client=createAlpacaDataFetch(async()=>{calls++;return Response.json({})});
 await assert.rejects(client(new URL("https://api.alpaca.markets/v2/orders"),options()),/market-data GET/);
 await assert.rejects(client(url(),{...options(),method:"POST"}),/market-data GET/);assert.equal(calls,0);
});
