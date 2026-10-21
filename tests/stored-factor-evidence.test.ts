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
