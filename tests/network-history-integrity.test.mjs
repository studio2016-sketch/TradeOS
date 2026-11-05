import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='./alpaca-data-fetch')return nextResolve(new URL('./fixtures/network-history-integrity-transport.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {observedNetworkAndCrossAssetEvidence}=await import('../lib/research/network-crossasset-evidence.ts');
hooks.deregister();
const bars=()=>Array.from({length:70},(_,i)=>({t:new Date(Date.UTC(2026,6,1+i,5)).toISOString(),c:100+i+(i%3),o:100,h:200,l:99,v:1000}));
async function run(corruptSymbol,field,value,index=35){
 const old=Object.fromEntries(['ALPACA_API_KEY','ALPACA_API_SECRET','MASSIVE_API_KEY','ALPACA_FEED'].map(k=>[k,process.env[k]]));
 process.env.ALPACA_API_KEY='test-only';process.env.ALPACA_API_SECRET='test-only';process.env.ALPACA_FEED='iex';delete process.env.MASSIVE_API_KEY;
 const calls=[];
 globalThis.__networkHistoryFetch=async url=>{
  const u=new URL(url),symbol=u.pathname.split('/').at(-2);calls.push(symbol);
  const data=bars();if(symbol===corruptSymbol)data[index][field]=value;
  return {ok:true,json:async()=>({bars:data})};
 };
 try{return {result:await observedNetworkAndCrossAssetEvidence(new Date('2026-10-01T00:00:00Z')),calls};}
 finally{delete globalThis.__networkHistoryFetch;for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
test('actual collector and history adapter retain valid risk bundles with no extra provider work',async()=>{
 const {result,calls}=await run();
 const risks=result.candidates.filter(x=>['beta','rolling_correlation','equity_bond_correlation'].includes(x.factor));
 assert.equal(risks.length,7);assert.ok(risks.every(x=>x.metadata.riskReplay));
 assert.equal(calls.filter(x=>x==='SPY').length,1);
});
test('invalid own close cannot be silently omitted before producing risk or relative evidence',async()=>{
 for(const value of [0,-1,null,'100',NaN,Infinity]){
  const {result}=await run('NVDA','c',value);
  assert.equal(result.candidates.filter(x=>x.subject==='NVDA').length,0);
  assert.ok(result.diagnostics.some(x=>x.symbol==='NVDA'&&/invalid timestamp or close/.test(x.riskContextError??'')));
  assert.ok(result.candidates.some(x=>x.subject==='AMD'&&x.factor==='beta'));
 }
});
test('invalid benchmark timestamp prevents all dependent paired-risk factors',async()=>{
 const {result,calls}=await run('SPY','t','not-a-timestamp');
 assert.equal(calls.filter(x=>x==='SPY').length,1);
 assert.equal(result.candidates.filter(x=>['beta','rolling_correlation','equity_bond_correlation'].includes(x.factor)).length,0);
 assert.ok(result.diagnostics.some(x=>x.pair==='SPY/TLT'&&/invalid timestamp or close/.test(x.error??'')));
 // Unrelated sector/industry calculations are still independently eligible.
 assert.ok(result.candidates.some(x=>x.factor==='sector_relative_return'));
});
test('an invalid old row outside selected windows conservatively rejects the fetched response',async()=>{
 const {result,calls}=await run('NVDA','t',null,0);
 assert.equal(calls.filter(x=>x==='NVDA').length,1);
 assert.equal(result.candidates.filter(x=>x.subject==='NVDA').length,0);
});
