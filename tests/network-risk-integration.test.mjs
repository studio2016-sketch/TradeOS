import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='../market/features')return {url:'data:text/javascript,export const historicalBars=(...args)=>globalThis.__riskBars(...args)',shortCircuit:true};
 if(specifier==='./synchronized-relative-return'||specifier==='./synchronized-risk-statistics')return nextResolve(specifier+'.ts',context);
 return nextResolve(specifier,context);
}});
const {observedNetworkAndCrossAssetEvidence}=await import('../lib/research/network-crossasset-evidence.ts');
hooks.deregister();
const bars=()=>Array.from({length:70},(_,i)=>({t:new Date(Date.UTC(2026,6,1+i,5)).toISOString(),c:100+i+(i%3),o:100,h:102,l:99,v:1000}));
const run=async(gap=false)=>{
 const calls=[];
 globalThis.__riskBars=async(symbol)=>{calls.push(symbol);const data=bars();return symbol==='NVDA'&&gap?data.filter((_,i)=>i!==60):data;};
 const oldKey=process.env.MASSIVE_API_KEY;delete process.env.MASSIVE_API_KEY;
 try{return {result:await observedNetworkAndCrossAssetEvidence(new Date('2026-10-01T00:00:00Z')),calls};}
 finally{if(oldKey!==undefined)process.env.MASSIVE_API_KEY=oldKey;delete globalThis.__riskBars;}
};
test('collector emits exact synchronized risk provenance with completion receipt time',async()=>{
 const {result,calls}=await run();
 const risk=result.candidates.filter(x=>['beta','rolling_correlation','equity_bond_correlation'].includes(x.factor));
 assert.equal(risk.length,7);
 for(const row of risk){
  const n=row.factor==='beta'?60:20;
  assert.equal(row.metadata.sampleCount,n);assert.equal(row.metadata.sessionDates.length,n+1);
  assert.equal(row.availableAt,result.retrievedAt);assert.ok(Date.parse(row.availableAt)>=Date.parse(result.requestedAt));
  assert.equal(row.observedAt,bars().at(-1).t);assert.match(row.metadata.method,/synchronized_return_/);
 }
 assert.equal(calls.filter(x=>x==='SPY').length,1);
});
test('collector omits mismatched NVDA risk while preserving valid peers',async()=>{
 const {result}=await run(true);
 assert.equal(result.candidates.filter(x=>x.subject==='NVDA'&&['beta','rolling_correlation'].includes(x.factor)).length,0);
 assert.equal(result.diagnostics.filter(x=>x.symbol==='NVDA'&&['beta','rolling_correlation'].includes(x.factor)).length,2);
 assert.ok(result.candidates.some(x=>x.subject==='AMD'&&x.factor==='beta'));
});
