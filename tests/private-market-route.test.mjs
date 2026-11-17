import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {createHash} from 'node:crypto';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier.includes('/internal-audit-models/'))return nextResolve(new URL('./fixtures/detailed-audit-services.mjs?name='+specifier.split('/').at(-1),import.meta.url).href,context);
 if(specifier.endsWith('/strict-provider-clock')||specifier==='../../../lib/broker/alpaca')return nextResolve(new URL('./fixtures/market-audit-aux.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {GET}=await import('../app/api/private-market-audit/route.ts');
test('actual authorized session route preserves 90-second flow and projects no raw observations',async()=>{
 const old=process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256,oldNow=Date.now,oldTimeout=globalThis.setTimeout;const token='ab'.repeat(32);let now=Date.parse('2026-11-17T16:00:00Z'),waits=0;
 process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=createHash('sha256').update(token).digest('hex');Date.now=()=>now;
 globalThis.setTimeout=(fn,ms,...args)=>{if(ms===90000){waits++;now+=90000;return oldTimeout(fn,0,...args);}return oldTimeout(fn,ms,...args);};
 globalThis.__marketClock=()=>({timestamp:new Date(now).toISOString(),isOpen:true,nextOpen:'2026-11-18T14:30:00Z',nextClose:'2026-11-17T21:00:00Z'});
 globalThis.__detailedCalls=[];globalThis.__detailedFixtures={market:()=>Response.json({private:'SECRET-CANARY',snapshots:['SPY','QQQ'].map(symbol=>({symbol,source:'Synthetic',price:123.45,timestamp:new Date(now).toISOString()}))}),chart:{symbol:'SPY',source:'Synthetic',points:[{t:'2026-11-17T16:00:00Z',c:100,private:'SECRET-CANARY'}]}};
 const request=scope=>new Request('https://audit.invalid/api/private-market-audit?scope='+scope,{headers:{authorization:'Bearer '+token}});
 try{
  assert.equal((await GET(new Request('https://audit.invalid/api/private-market-audit?scope=advancement'))).status,401);assert.equal(globalThis.__detailedCalls.length,0);
  for(const scope of ['readiness','advancement']){const r=await GET(request(scope));assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('SECRET-CANARY'));assert.ok(!text.includes('123.45'));assert.ok(!text.includes('Synthetic'));assert.ok(Object.values(JSON.parse(text).checks).every(x=>x==='PASS'));}
  assert.equal(waits,1);assert.equal(globalThis.__detailedCalls.filter(x=>x.name==='market').length,2);
  globalThis.__marketClock=()=>({timestamp:new Date(now).toISOString(),isOpen:false,nextOpen:'2026-11-18T14:30:00Z',nextClose:'2026-11-17T21:00:00Z'});
  const closed=await GET(request('advancement'));assert.equal(closed.status,200);assert.ok(Object.values((await closed.json()).checks).every(x=>x==='NOT_RUN_MARKET_CLOSED'));assert.equal(waits,1);
  assert.equal((await GET(request('other'))).status,400);
 }finally{hooks.deregister();Date.now=oldNow;globalThis.setTimeout=oldTimeout;delete globalThis.__marketClock;delete globalThis.__detailedCalls;delete globalThis.__detailedFixtures;if(old===undefined)delete process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;else process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=old;}
});
