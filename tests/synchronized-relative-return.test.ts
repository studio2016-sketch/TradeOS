import test from "node:test";
import assert from "node:assert/strict";
import {synchronizedRelativeReturn} from "../lib/research/synchronized-relative-return.ts";

const bars=(start:number,end:number)=>Array.from({length:21},(_,i)=>({t:new Date(Date.UTC(2026,8,i+1,20)).toISOString(),c:start+(end-start)*i/20}));
test("relative return uses independent arithmetic over identical session windows",()=>{
 const result=synchronizedRelativeReturn(bars(100,120),bars(200,220));
 assert.ok(result);
 assert.ok(Math.abs(result.value-.1)<1e-12);
 assert.equal(result.sessionDates.length,21);
 assert.equal(result.observedAt,"2026-09-21T20:00:00.000Z");
 assert.deepEqual(synchronizedRelativeReturn(bars(100,120).reverse(),bars(200,220)),result);
});
test("mismatched endpoints or intervening dates cannot produce relative evidence",()=>{
 const own=bars(100,120),proxy=bars(200,220);
 const stale=proxy.map(b=>({...b,t:new Date(Date.parse(b.t)-86400000).toISOString()}));
 assert.equal(synchronizedRelativeReturn(own,stale),null);
 const missing=proxy.filter((_,i)=>i!==10);
 missing.unshift({t:"2026-08-31T20:00:00Z",c:190});
 assert.equal(synchronizedRelativeReturn(own,missing),null);
});
test("invalid, duplicate, insufficient and nonfinite inputs fail closed",()=>{
 const own=bars(100,120),proxy=bars(200,220);
 assert.equal(synchronizedRelativeReturn(own.slice(1),proxy),null);
 assert.equal(synchronizedRelativeReturn(own,proxy,0),null);
 assert.equal(synchronizedRelativeReturn(own,proxy,1.5),null);
 for(const bad of [{...proxy[0],c:0},{...proxy[0],c:NaN},{...proxy[0],c:Infinity},{...proxy[0],t:"invalid"},proxy[1]]){
  assert.equal(synchronizedRelativeReturn(own,[bad,...proxy.slice(1)]),null);
 }
});
test("observation timestamp is no earlier than either latest input",()=>{
 const own=bars(100,120),proxy=bars(200,220);
 proxy[20].t="2026-09-21T21:00:00Z";
 assert.equal(synchronizedRelativeReturn(own,proxy)?.observedAt,"2026-09-21T21:00:00.000Z");
});
