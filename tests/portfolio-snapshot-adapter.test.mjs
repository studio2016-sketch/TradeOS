import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='../broker/alpaca'||specifier==='../market/features')return nextResolve(new URL('./fixtures/portfolio-snapshot-services.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {observedPortfolioFactorEvidence}=await import('../lib/research/portfolio-factor-evidence.ts');
test('adapter emits no candidates or measured status for incomplete/duplicated holdings',async()=>{
 try{
  for(const position of [{symbol:'BBB',marketValue:NaN},{symbol:'',marketValue:6000},{symbol:'AAA',marketValue:-4000}]){
   globalThis.__portfolioSnapshot={equity:10000,positions:[{symbol:'AAA',marketValue:4000},position],generatedAt:'2026-11-18T12:00:00Z',environment:'paper'};
   const result=await observedPortfolioFactorEvidence(new Date('2026-11-18T12:01:00Z'));
   assert.deepEqual(result.candidates,[]);assert.equal(result.status,'portfolio_snapshot_unavailable');
  }
  globalThis.__portfolioSnapshot={equity:10000,positions:[],generatedAt:'2026-11-18T12:00:00Z',environment:'paper'};
  const empty=await observedPortfolioFactorEvidence(new Date('2026-11-18T12:01:00Z'));
  assert.equal(empty.status,'empty_portfolio_exposure_measured_uncertified');assert.equal(empty.candidates.length,2);
  assert.ok(empty.candidates.every(x=>x.value===0));
 }finally{delete globalThis.__portfolioSnapshot;hooks.deregister();}
});
