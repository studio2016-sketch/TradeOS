import test from "node:test";
import assert from "node:assert/strict";
import {evaluateSourceReliability} from "../lib/market/sourceReliability";
import type {SourceHealth} from "../lib/market/types";

const asOf=new Date("2026-11-11T12:00:00Z");
const officialIds=["cftc","finra","treasury","bls-data","cboe","alfred","bea","eia"];
function configured(id:string):SourceHealth{return {id,label:id,state:"available",quality:90,authoritative:true,note:"Adapter configured; response not yet verified"}}
function dataFor(id:string){
  if(id==="cftc")return [{date:"2026-11-11",openInterest:null,leveragedMoneyNetPct:null}];
  if(id==="finra")return [{regShoDate:"2026-11-11",totalVolume:null,shortVolume:null,shortVolumeRatio:null}];
  if(id==="treasury")return {date:"2026-11-11",y10:null,y2:null,curve10y2y:null};
  if(id==="bls-data")return [{period:"2026-M10",value:null,previous:null,change:null}];
  return null;
}
function source(id:string,status:unknown){return {id,status,data:dataFor(id),note:"Official research context",generatedAt:asOf.toISOString()}}

test("dated degraded official sources cannot count as verified, fresh or decision-grade",t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  const result=evaluateSourceReliability({configured:officialIds.map(configured),official:{sources:officialIds.map(id=>source(id,"degraded"))}});
  assert.equal(result.verifiedSources,0);
  assert.equal(result.decisionGradeSources,0);
  for(const row of result.rows){
    assert.equal(row.connected,true,row.id);
    assert.equal(row.runtimeVerified,false,row.id);
    assert.equal(row.freshness,"unknown",row.id);
    assert.equal(row.decisionGrade,false,row.id);
  }
});

test("degraded payload timestamps and partial values cannot rehabilitate failed source health",t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  for(const date of ["2026-11-11","2026-11-10","2020-01-01","2099-01-01"]){
    const off={...source("finra","degraded"),data:[{regShoDate:date,shortVolumeRatio:25,totalVolume:100}],error:"Partial dataset failure"};
    const result=evaluateSourceReliability({configured:[configured("finra")],official:{sources:[off]}});
    assert.equal(result.rows[0].runtimeVerified,false);
    assert.equal(result.rows[0].freshness,"unknown");
    assert.equal(result.rows[0].decisionGrade,false);
    assert.match(result.rows[0].note,/Partial dataset failure/);
    assert.equal(result.verifiedSources,0);
    assert.equal(result.decisionGradeSources,0);
  }
});

test("unrecognized official statuses cannot fall through to timestamp-derived verification",t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  for(const status of [undefined,null,"",false,true,"ok","LIVE","offline","stale"]){
    const result=evaluateSourceReliability({configured:[configured("finra")],official:{sources:[source("finra",status)]}});
    assert.equal(result.rows[0].runtimeVerified,false,String(status));
    assert.equal(result.rows[0].freshness,"unknown",String(status));
    assert.equal(result.rows[0].decisionGrade,false,String(status));
    assert.equal(result.verifiedSources,0);
  }
});

test("failed malformed payloads do not enter successful-response freshness parsing",()=>{
  for(const status of ["degraded","unrecognized"]){
    const result=evaluateSourceReliability({configured:[configured("finra")],official:{sources:[{...source("finra",status),data:[null]}]}});
    assert.equal(result.rows[0].runtimeVerified,false);
    assert.equal(result.rows[0].freshness,"unknown");
    assert.equal(result.decisionGradeSources,0);
  }
});

test("unconfigured and absent official responses retain unavailable states",()=>{
  const unconfigured=evaluateSourceReliability({configured:[{...configured("bea"),state:"unconfigured"}],official:{sources:[source("bea","unconfigured")]}});
  assert.equal(unconfigured.rows[0].connected,false);
  assert.equal(unconfigured.rows[0].runtimeVerified,false);
  assert.equal(unconfigured.rows[0].freshness,"unconfigured");
  assert.equal(unconfigured.decisionGradeSources,0);
  const absent=evaluateSourceReliability({configured:[configured("finra")]});
  assert.equal(absent.rows[0].runtimeVerified,false);
  assert.equal(absent.rows[0].freshness,"unknown");
  assert.equal(absent.verifiedSources,0);
});

test("a subsequent successful response can recover, while a later failure removes eligibility",t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  for(const status of ["degraded","live","degraded"]){
    const off={...source("finra",status),data:[{regShoDate:"2026-11-11",shortVolumeRatio:25,totalVolume:100}]};
    const result=evaluateSourceReliability({configured:[configured("finra")],official:{sources:[off]}});
    assert.equal(result.rows[0].runtimeVerified,status==="live");
    assert.equal(result.rows[0].decisionGrade,status==="live");
    assert.equal(result.verifiedSources,status==="live"?1:0);
    assert.equal(result.decisionGradeSources,status==="live"?1:0);
  }
});

test("successful stale source observations retain existing stale exclusions",t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  const result=evaluateSourceReliability({configured:[configured("finra")],official:{sources:[{...source("finra","live"),data:[{regShoDate:"2020-01-01",totalVolume:100}]}]}});
  assert.equal(result.rows[0].runtimeVerified,true);
  assert.equal(result.rows[0].freshness,"stale");
  assert.equal(result.rows[0].decisionGrade,false);
  assert.equal(result.verifiedSources,0);
  assert.equal(result.decisionGradeSources,0);
});

test("degraded official rows cannot inflate the multi-source count alongside a usable market probe",t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  const result=evaluateSourceReliability({
    configured:[{...configured("massive"),authoritative:false},...officialIds.map(configured)],
    official:{sources:officialIds.map(id=>source(id,"degraded"))},
    marketProbe:{provider:"massive",snapshots:[{timestamp:asOf.toISOString(),source:"Massive"}]},sessionOpen:true
  });
  assert.equal(result.rows.find(row=>row.id==="massive")?.decisionGrade,true);
  assert.equal(result.consolidatedRealtimeEquities,true);
  assert.equal(result.verifiedSources,1);
  assert.equal(result.decisionGradeSources,1);
  assert.equal(result.decisionGradeSources>=6,false);
  assert.equal(result.independentRealtimeMarketRedundancy,false);
});
