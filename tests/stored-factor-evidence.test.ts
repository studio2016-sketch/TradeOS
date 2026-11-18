import test from "node:test";
import assert from "node:assert/strict";
import {storedFactorEvidence} from "../lib/research/stored-factor-evidence.ts";

const base={symbol:"NVDA",market_time:"2026-10-20T14:00:00Z",recorded_at:"2026-10-20T14:01:00Z",provider:"Alpaca:iex"};

test("accepts direct and provenance-backed derived factors",()=>{
 const evidence=storedFactorEvidence([{...base,features:{daily_volume:1000,sma_20:123,headline_count:null},news:{history:{source:"Alpaca:iex",barCount:200},derivedFactors:{sma_20:{value:123,asOf:"2026-10-19T00:00:00Z"}}}}]);
 assert.deepEqual(evidence.map(x=>x.factor).sort(),["daily_volume","sma_20"]);
 assert.equal(evidence.find(x=>x.factor==="sma_20")?.observedAt,"2026-10-19T00:00:00Z");
});

test("rejects finite values lacking matching source provenance",()=>{
 const evidence=storedFactorEvidence([{...base,features:{sma_20:123,market_cap:500},news:{history:{source:"Alpaca:iex",barCount:0},fundamentals:{status:"http_error"}}}]);
 assert.equal(evidence.length,0);
});

test("counts verified empty news results but not failed empty queries",()=>{
 const clean=storedFactorEvidence([{...base,features:{headline_count:0},news:{news:[],errors:[]}}]);
 const failed=storedFactorEvidence([{...base,features:{headline_count:0},news:{news:[],errors:["provider failed"]}}]);
 assert.equal(clean[0]?.domain,"news");
 assert.equal(failed.length,0);
});

test("news uses exact chronological maximum across timezone offsets, not lexical order",()=>{
 const news={news:[{source:"A",timestamp:"2026-10-20T14:30:00+01:00"},{source:"B",timestamp:"2026-10-20T13:45:00Z"}]};
 const row={...base,features:{headline_count:2},news};
 const result=storedFactorEvidence([row]);
 assert.equal(result.length,1);assert.equal(result[0].observedAt,"2026-10-20T13:45:00Z");
 assert.equal(storedFactorEvidence([{...row,news:{news:[...news.news].reverse()}}])[0].observedAt,result[0].observedAt);
});
test("one future or invalid contributing article suppresses news without suppressing direct values",()=>{
 const valid={source:"A",timestamp:"2026-10-20T14:00:00Z"};
 for(const article of [null,{}, {timestamp:"2026-10-20"},{timestamp:"2026-02-30T12:00:00Z"},{timestamp:"2026-10-20T14:01:00.000000001Z"},{timestamp:"2026-10-20T09:30:00-05:00"}]){
  const result=storedFactorEvidence([{...base,features:{headline_count:2,daily_volume:1000},news:{news:[valid,article]}}]);
  assert.deepEqual(result.map(x=>x.factor),["daily_volume"]);
 }
});
test("nanosecond source timing preserves receipt boundaries and original spelling",()=>{
 const at="2026-10-20T14:01:00.000000001Z";
 const result=storedFactorEvidence([{...base,recorded_at:at,features:{headline_count:2},news:{news:[{timestamp:"2026-10-20T14:01:00Z"},{timestamp:at}]}}]);
 assert.equal(result[0].observedAt,at);
 assert.equal(storedFactorEvidence([{...base,market_time:at,features:{daily_volume:1000}}]).length,0);
});
test("empty-result provenance requires an actual empty array and zero measurement",()=>{
 for(const news of [{errors:[]},{news:null,errors:[]},{news:[],errors:[]}]){
  const row={...base,features:{headline_count:5,news_source_diversity:1,headline_novelty:1},news};
  assert.equal(storedFactorEvidence([row]).length,0);
 }
 const result=storedFactorEvidence([{...base,features:{headline_count:0,news_source_diversity:0,headline_novelty:0},news:{news:[],errors:[]}}]);
 assert.equal(result.length,3);
});

test("price-history derived provenance cannot bypass news article validation",()=>{
 const result=storedFactorEvidence([{...base,features:{headline_count:2},news:{history:{source:"Alpaca:iex",barCount:200},derivedFactors:{headline_count:{value:2,asOf:base.market_time}},news:[{timestamp:"invalid"}]}}]);
 assert.equal(result.length,0);
});
