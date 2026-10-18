import test from "node:test";import assert from "node:assert/strict";import {historicalBars} from "../lib/market/features";
test("historical bars request newest available data but return chronological series",async()=>{
 const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET,fetchBefore=globalThis.fetch;
 try{
  process.env.ALPACA_API_KEY="test";process.env.ALPACA_API_SECRET="test";
  globalThis.fetch=(async(input:RequestInfo|URL)=>{
   const u=new URL(String(input));assert.equal(u.searchParams.get("sort"),"desc");
   return new Response(JSON.stringify({bars:[{t:"2026-10-16T19:55:00Z",c:101,o:100,h:102,l:99,v:10},{t:"2026-10-16T19:50:00Z",c:100,o:100,h:101,l:99,v:12}]}),{status:200});
  }) as typeof fetch;
  const data=await historicalBars("AAPL","5Min","2026-10-16T00:00:00Z",100);
  assert.deepEqual(data.map(x=>x.c),[100,101]);
 }finally{globalThis.fetch=fetchBefore;if(key===undefined)delete process.env.ALPACA_API_KEY;else process.env.ALPACA_API_KEY=key;if(secret===undefined)delete process.env.ALPACA_API_SECRET;else process.env.ALPACA_API_SECRET=secret}
});
