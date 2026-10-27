import test from "node:test";
import assert from "node:assert/strict";
import {discoverHistoricalFactorAssociations} from "../lib/research/historical-factor-discovery.ts";

function records(label:string,effect:number){
 return Array.from({length:12},(_,day)=>Array.from({length:10},(_,i)=>({
  time:new Date(Date.UTC(2026,0,day+1,15,i)).toISOString(),symbol:["AAPL","MSFT","NVDA"][i%3],horizon:"30m",label,value:i,signedReturn:(i>4?effect:-effect)+(day%2?0.0001:-0.0001)
 }))).flat();
}
test("historical discovery uses the entire submitted hypothesis family and never promotes",()=>{
 const result=discoverHistoricalFactorAssociations([...records("positive_factor",.01),...records("null_factor",0)]);
 assert.equal(result.testedFamilySize,2);
 const positive=result.findings.find(x=>x.label==="positive_factor")!;
 assert.equal(positive.sessions,12);assert.equal(positive.symbols,3);assert.ok((positive.medianSplitReturnSpread??0)>0);
 assert.equal(positive.sameDirection,true);assert.equal(positive.validated,false);assert.equal(positive.eligibleForModelPromotion,false);
});
test("duplicate values and shallow session depth fail closed",()=>{
 const rows=records("shallow",.01).filter(x=>x.time.slice(0,10)<="2026-01-03");
 const [finding]=discoverHistoricalFactorAssociations(rows).findings;
 assert.equal(finding.status,"INSUFFICIENT_INDEPENDENT_DEPTH");assert.equal(finding.pValue,null);
});
