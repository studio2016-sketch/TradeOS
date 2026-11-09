import test from 'node:test';
import assert from 'node:assert/strict';
import {bestSnapshots} from '../lib/market/live';

test('preserve losing IEX quote timestamps while retaining the existing price-based provider choice',async()=>{
 const keys=['ALPACA_API_KEY','ALPACA_API_SECRET','ALPACA_FEED','ALPACA_DELAYED_SIP_FALLBACK','MASSIVE_API_KEY'];
 const env={...process.env},originalFetch=globalThis.fetch,now=Date.now();
 const iso=(offset:number)=>new Date(now-offset).toISOString();
 try{
  process.env.ALPACA_API_KEY='selection-diagnostic-test';process.env.ALPACA_API_SECRET='test';process.env.ALPACA_FEED='iex';process.env.ALPACA_DELAYED_SIP_FALLBACK='true';delete process.env.MASSIVE_API_KEY;
  let calls=0;
  globalThis.fetch=async(input)=>{
   calls++;const delayed=new URL(String(input)).searchParams.get('feed')==='delayed_sip';
   return Response.json({TEST:{latestTrade:{p:100,t:iso(delayed?900000:1200000)},latestQuote:{t:iso(delayed?900000:1000),bp:99,ap:101}}});
  };
  const r=await bestSnapshots(['TEST']);assert.equal(calls,2);assert.equal(r.snapshots[0].source,'Alpaca:delayed_sip');
  assert.deepEqual(r.selectionDiagnostics.map(d=>({source:d.sourceId,quote:d.quoteAt,selected:d.selected})),[
   {source:'Alpaca:iex',quote:iso(1000),selected:false},{source:'Alpaca:delayed_sip',quote:iso(900000),selected:true}]);
  assert.ok(r.selectionDiagnostics.every(d=>d.selectionEligible));
  assert.equal('price' in r.selectionDiagnostics[0],false);
 }finally{globalThis.fetch=originalFetch;for(const key of keys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key]}}
});
