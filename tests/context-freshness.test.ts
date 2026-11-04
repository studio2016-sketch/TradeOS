import test from "node:test";
import assert from "node:assert/strict";
import {broadIntradayContext} from "../lib/market/context-freshness.ts";
import {buildMarketContext} from "../lib/market/context.ts";
import type {FeatureSet} from "../lib/market/features.ts";
const time=Date.parse("2026-11-04T19:00:00Z");
const feature=(symbol:string,age=60_000,current=true,score:number|null=60)=>({symbol,generatedAt:new Date(time-age).toISOString(),daily:{trendScore:70,roc20Pct:5},intraday:{trendScore:score},quality:{latestIntradayBar:new Date(time-age).toISOString(),underlyingDataCurrent:current}} as FeatureSet);
const sources=()=>new Map(["SPY","QQQ","IWM"].map(s=>[s,feature(s)]));

test("broad internals requires all three recent inputs and preserves original observations",()=>{
 const data=sources();data.set("QQQ",feature("QQQ",60_000,true,30));data.set("IWM",feature("IWM",60_000,true,90));
 const result=broadIntradayContext(data,time);assert.equal(result.score,60);assert.equal(result.quality.eligibleCount,3);
 assert.equal(result.quality.inputs[0].sourceTimestamp,new Date(time-60_000).toISOString());assert.equal(result.quality.inputs[0].featureGeneratedAt,new Date(time-60_000).toISOString());
 assert.match(result.quality.note,/do not certify/);
});

test("stale, future, missing, invalid, and explicitly non-current inputs fail closed",()=>{
 const cases:[FeatureSet|null,string][]=[
  [feature("SPY",20*60_000),"stale_observation"],
  [feature("SPY",21*60_000),"stale_observation"],
  [feature("SPY",-1),"future_observation"],
  [null,"missing_features"],
  [feature("SPY",60_000,false),"not_current"],
  [feature("SPY",60_000,true,null),"invalid_or_missing_score"],
  [feature("SPY",60_000,true,NaN),"invalid_or_missing_score"]
 ];
 for(const [value,reason] of cases){const data=new Map<string,FeatureSet|null>(sources());data.set("SPY",value);const result=broadIntradayContext(data,time);assert.equal(result.score,null);assert.equal(result.quality.inputs[0].reason,reason);assert.equal(result.quality.eligibleCount,2)}
 for(const stamp of [null,"bad","1970-01-01T00:00:00Z"]){const data=sources();data.get("SPY")!.quality.latestIntradayBar=stamp;const result=broadIntradayContext(data,time);assert.equal(result.score,null);assert.equal(result.quality.inputs[0].reason,"invalid_or_missing_timestamp")}
});

test("new calculation timestamp cannot make a stale source current; scores of zero remain valid",()=>{
 const data=sources();for(const s of data.values())s.intraday.trendScore=0;
 assert.equal(broadIntradayContext(data,time).score,0);
 assert.equal(broadIntradayContext(data,time+20*60_000).score,null);
});

test("context suppresses stale intraday internals without fabricating daily values",async()=>{
 const env={...process.env},oldFetch=globalThis.fetch;
 try{
  process.env.ALPACA_API_KEY="context-freshness";process.env.ALPACA_API_SECRET="test";
  globalThis.fetch=async()=>Response.json({bars:[]});
  const current=Date.now();
  const load=async(symbol:string)=>{const f=feature(symbol);f.quality.latestIntradayBar=new Date(current-21*60_000).toISOString();f.generatedAt=new Date(current-21*60_000).toISOString();return f};
  const context=await buildMarketContext("AAPL",load);
  assert.equal(context!.broad.internalsScore,null);assert.equal(context!.broad.breadthScore,70);
  assert.equal(context!.correlation.spy20,null);assert.equal(context!.intradaySourceQuality.eligibleCount,0);
  assert.ok(context!.intradaySourceQuality.inputs.every(i=>i.reason==="stale_observation"));
  assert.ok(Date.parse(context!.generatedAt)>Date.parse(context!.intradaySourceQuality.inputs[0].sourceTimestamp!));
 }finally{globalThis.fetch=oldFetch;for(const key of ["ALPACA_API_KEY","ALPACA_API_SECRET"]){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});

test("slow correlation I/O cannot keep newly expired intraday inputs eligible",async(t)=>{
 const env={...process.env},oldFetch=globalThis.fetch;
 t.mock.timers.enable({apis:["Date"],now:time});
 try{
  process.env.ALPACA_API_KEY="context-slow-io";process.env.ALPACA_API_SECRET="test";
  let advanced=false;
  globalThis.fetch=async()=>{if(!advanced){advanced=true;t.mock.timers.tick(2*60_000)}return Response.json({bars:[]})};
  const load=async(symbol:string)=>feature(symbol,19*60_000);
  const context=await buildMarketContext("AAPL",load);
  assert.equal(context!.broad.internalsScore,null);
  assert.equal(context!.generatedAt,new Date(time+2*60_000).toISOString());
  assert.ok(context!.intradaySourceQuality.inputs.every(i=>i.ageMs===21*60_000&&i.reason==="stale_observation"));
 }finally{globalThis.fetch=oldFetch;t.mock.timers.reset();for(const key of ["ALPACA_API_KEY","ALPACA_API_SECRET"]){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});
