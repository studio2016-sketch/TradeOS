import test from "node:test";import assert from "node:assert/strict";
import {factorRedundancyStudy} from "../lib/research/factorRedundancy";
test("Correlated factors are detected on shared forecast rows",()=>{
 const input=Array.from({length:40},(_,i)=>[
  {forecastId:String(i),label:"Momentum",value:i+1},
  {forecastId:String(i),label:"Trend duplicate",value:(i+1)*2},
  {forecastId:String(i),label:"Other",value:(i%7)-3}
 ]).flat();
 const r=factorRedundancyStudy(input);
 const pair=r.pairs.find(p=>p.first==="Momentum"&&p.second==="Trend duplicate");
 assert.ok(pair);assert.equal(pair!.pearsonR,1);assert.equal(pair!.status,"HIGH_CORRELATION");
});
test("Sparse pairs do not become spurious dependence claims",()=>{
 const r=factorRedundancyStudy([{forecastId:"a",label:"X",value:1},{forecastId:"a",label:"Y",value:2}]);
 assert.equal(r.pairs.length,0);
});
