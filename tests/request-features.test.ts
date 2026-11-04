import test from "node:test";
import assert from "node:assert/strict";
import {createRequestFeatureLoader} from "../lib/market/request-features.ts";
import {featureSet,type FeatureSet} from "../lib/market/features.ts";
import {buildMarketContext} from "../lib/market/context.ts";
import {readFileSync} from "node:fs";

const fixture=(symbol:string,stamp:string,current=true)=>({symbol,feed:"iex",generatedAt:stamp,daily:{trendScore:70,roc20Pct:5},intraday:{trendScore:60},quality:{latestIntradayBar:stamp,intradayAgeMs:0,underlyingDataCurrent:current}} as FeatureSet);

test("request feature loader shares concurrent and sequential work, without leaking into a later request",async()=>{
 let calls=0;const time=Date.now(),stamp=new Date(time).toISOString();
 const source=async(symbol:string)=>{calls++;return fixture(symbol,stamp)};
 const load=createRequestFeatureLoader(source,()=>time);
 const [a,b]=await Promise.all([load("AAPL"),load("AAPL")]);assert.equal(calls,1);assert.deepEqual(a,b);assert.notEqual(a,b);
 a!.daily.trendScore=0;assert.equal((await load("AAPL"))!.daily.trendScore,70);assert.equal(calls,1);
 await load("SPY");assert.equal(calls,2);
 await createRequestFeatureLoader(source)("AAPL");assert.equal(calls,3);
});

test("reuse preserves provenance and ages current flags during long-running work",async()=>{
 let time=Date.parse("2026-11-04T19:00:00Z");const stamp=new Date(time).toISOString();
 const load=createRequestFeatureLoader(async symbol=>fixture(symbol,stamp),()=>time);
 const fresh=await load("AAPL");assert.equal(fresh!.quality.underlyingDataCurrent,true);
 time+=20*60_000;const stale=await load("AAPL");
 assert.equal(stale!.quality.intradayAgeMs,20*60_000);assert.equal(stale!.quality.underlyingDataCurrent,false);
 assert.equal(stale!.quality.latestIntradayBar,stamp);assert.equal(stale!.generatedAt,stamp);
 const unavailable=createRequestFeatureLoader(async symbol=>fixture(symbol,stamp,false),()=>Date.parse(stamp));
 assert.equal((await unavailable("AAPL"))!.quality.underlyingDataCurrent,false);
});

test("failed and null calculations are shared only for the current run; the next run can recover",async()=>{
 let calls=0;const failure=new Error("Alpaca HTTP 429");
 const source=async(symbol:string)=>{calls++;if(calls===1)throw failure;return fixture(symbol,new Date().toISOString())};
 const load=createRequestFeatureLoader(source);
 const outcomes=await Promise.allSettled([load("AAPL"),load("AAPL")]);
 assert.equal(calls,1);assert.ok(outcomes.every(x=>x.status==="rejected"&&x.reason===failure));
 await assert.rejects(load("AAPL"),/HTTP 429/);assert.equal(calls,1);
 assert.ok(await createRequestFeatureLoader(source)("AAPL"));assert.equal(calls,2);
 let emptyCalls=0;const empty=createRequestFeatureLoader(async()=>{emptyCalls++;return null});
 assert.deepEqual(await Promise.all([empty("SPY"),empty("SPY")]),[null,null]);assert.equal(emptyCalls,1);
});

test("alignment and default ingest reuse feature families without changing context arithmetic",async()=>{
 const env={...process.env},before=globalThis.fetch;
 try{
  process.env.ALPACA_API_KEY="feature-reuse";process.env.ALPACA_API_SECRET="test";
  globalThis.fetch=async()=>Response.json({bars:[]});
  const counts=new Map<string,number>(),stamp=new Date().toISOString();
  const source=async(symbol:string)=>{counts.set(symbol,(counts.get(symbol)??0)+1);return fixture(symbol,stamp)};
  const alignmentLoad=createRequestFeatureLoader(source);
  const [selected,context]=await Promise.all([alignmentLoad("AAPL"),buildMarketContext("AAPL",alignmentLoad)]);
  assert.equal(selected!.symbol,"AAPL");assert.equal(counts.size,5);assert.equal(counts.get("AAPL"),1);
  const baseline=await buildMarketContext("AAPL",async symbol=>fixture(symbol,stamp));
  assert.deepEqual({...context,generatedAt:null},{...baseline,generatedAt:null});
  counts.clear();const ingestLoad=createRequestFeatureLoader(source);
  for(const symbol of ["NVDA","AMD","PLTR","SPY","QQQ","IWM"]){
   await Promise.all([ingestLoad(symbol),buildMarketContext(symbol,ingestLoad)]);
  }
  assert.equal(counts.size,8);assert.ok([...counts.values()].every(n=>n===1));
 }finally{globalThis.fetch=before;for(const key of ["ALPACA_API_KEY","ALPACA_API_SECRET"]){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});

test("real feature calculations retain price timestamps and features when reused",async()=>{
 const env={...process.env},before=globalThis.fetch;
 try{
  process.env.ALPACA_API_KEY="feature-parity";process.env.ALPACA_API_SECRET="test";
  const stamp=Date.now()-60_000;
  const bars=Array.from({length:90},(_,i)=>({t:new Date(stamp-(89-i)*300_000).toISOString(),o:100+i/10,h:102+i/10,l:99+i/10,c:101+i/10,v:1000+i,vw:101+i/10})).reverse();
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({bars})};
  const baseline=await featureSet("AAPL");assert.equal(calls,3);
  const load=createRequestFeatureLoader();const [a,b]=await Promise.all([load("AAPL"),load("AAPL")]);assert.equal(calls,6);
  for(const key of ["daily","hourly","intraday","structure"] as const){assert.deepEqual(a![key],baseline![key]);assert.deepEqual(b![key],baseline![key])}
  assert.equal(a!.quality.latestIntradayBar,baseline!.quality.latestIntradayBar);
  assert.equal(a!.generatedAt,b!.generatedAt);await load("AAPL");assert.equal(calls,6);
 }finally{globalThis.fetch=before;for(const key of ["ALPACA_API_KEY","ALPACA_API_SECRET"]){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});

test("request scopes are allocated inside both entry points and passed into market context",()=>{
 for(const path of ["../app/api/alignment/route.ts","../app/api/cron/ingest/route.ts"]){
  const code=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.ok(code.indexOf("const loadFeatures=createRequestFeatureLoader()")>code.indexOf("export async function GET"));
  assert.ok(code.includes("loadFeatures(symbol).catch"));assert.ok(code.includes("buildMarketContext(symbol,loadFeatures).catch"));
 }
});
