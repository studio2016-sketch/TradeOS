import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='./alpaca-data-fetch')return nextResolve(new URL('./fixtures/replay-history-transport.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {historicalBars}=await import('../lib/market/features.ts');hooks.deregister();
const good={t:'2026-10-16T15:00:00Z',o:100,h:101,l:99,c:100,v:1};
test('strict replay history rejects rows before chart sanitization can hide them',async()=>{
 const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
 process.env.ALPACA_API_KEY='fixture';process.env.ALPACA_API_SECRET='fixture';
 try{
  for(const invalid of [{...good,t:'invalid'},{...good,c:0},{...good,c:-1},{...good,c:null}]){
   globalThis.__replayDataFetch=async()=>Response.json({bars:[good,invalid]});
   await assert.rejects(()=>historicalBars('SPY','5Min','2026-10-16',1000,'iex','2026-10-17',true),/invalid timestamp or close/);
   assert.deepEqual(await historicalBars('SPY','5Min','2026-10-16',1000,'iex','2026-10-17'),[good]);
  }
  const later={...good,t:'2026-10-16T15:05:00Z'};
  globalThis.__replayDataFetch=async()=>Response.json({bars:[later,good]});
  assert.deepEqual(await historicalBars('SPY','5Min','2026-10-16',1000,'iex','2026-10-17',true),[good,later]);
 }finally{
  if(key===undefined)delete process.env.ALPACA_API_KEY;else process.env.ALPACA_API_KEY=key;
  if(secret===undefined)delete process.env.ALPACA_API_SECRET;else process.env.ALPACA_API_SECRET=secret;
  delete globalThis.__replayDataFetch;
 }
});
