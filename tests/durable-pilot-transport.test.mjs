import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){if(specifier==='../db')return nextResolve(new URL('./fixtures/durable-pilot-db.mjs',import.meta.url).href,context);return nextResolve(specifier,context);}});
const {currentPilotReceipt}=await import('../lib/research/durable-pilot-receipt.ts');
test('production receipt loader applies read-only transaction and abortable transport, with sanitized failure',async()=>{
 try{for(const fail of [false,true]){
  const f=globalThis.__receiptDb={calls:[],fail};const r=await currentPilotReceipt();assert.equal(r.status,fail?'unavailable':'none');assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].readOnly,true);assert.equal(f.calls[0].queries.length,1);assert.ok(f.calls[0].signal instanceof AbortSignal);assert.equal(f.calls[0].signal.aborted,true);
  assert.equal(r.ordersAllowed,false);assert.equal(r.certified,false);assert.ok(!JSON.stringify(r).includes('credential'));
 }}finally{hooks.deregister();delete globalThis.__receiptDb;}
});
