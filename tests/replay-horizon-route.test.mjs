import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='next/server'||specifier==='../../../lib/market/features')return nextResolve(new URL('./fixtures/replay-route-dependencies.mjs',import.meta.url).href,context);
 if(specifier==='../../../lib/research/replaySimulator')return nextResolve(specifier+'.ts',context);
 return nextResolve(specifier,context);
}});
const {GET}=await import('../app/api/replay-simulation/route.ts');hooks.deregister();
test('API rejects invalid horizon before requesting historical prices',async()=>{
 let calls=0;globalThis.__replayHistory=async()=>{calls++;return []};
 for(const bars of ['NaN','Infinity','1.5','0','501']){
  const response=await GET(new Request(`https://fixture.invalid/api/replay-simulation?symbol=SPY&decisionAt=2026-10-16T15:00:00Z&bars=${bars}`));
  assert.equal(response.status,400);
 }
 assert.equal(calls,0);delete globalThis.__replayHistory;
});
test('API exposes unresolved partial horizon with research-only certification and no P&L',async()=>{
 globalThis.__replayHistory=async()=>[{t:'2026-10-16T15:00:00Z',o:100,h:100.2,l:99.8,c:100.1,v:100}];
 const response=await GET(new Request('https://fixture.invalid/api/replay-simulation?symbol=SPY&decisionAt=2026-10-16T15:00:00Z&bars=20'));
 const result=await response.json();assert.equal(response.status,200);
 assert.equal(result.simulation.status,'INSUFFICIENT_HORIZON');assert.equal(result.simulation.netPnl,null);
 assert.equal(result.certification,'RESEARCH_ONLY');delete globalThis.__replayHistory;
});
