import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='../db')return nextResolve(new URL('./fixtures/risk-replay-db.mjs',import.meta.url).href,context);
 if(specifier==='../market/features')return nextResolve(new URL('./fixtures/network-risk-transport.mjs',import.meta.url).href,context);
 if(specifier==='./risk-replay-bundle'||specifier==='./synchronized-relative-return'||specifier==='./synchronized-risk-statistics')return nextResolve(specifier+'.ts',context);
 return nextResolve(specifier,context);
}});
const {observedNetworkAndCrossAssetEvidence}=await import('../lib/research/network-crossasset-evidence.ts');
const {checkRiskReplayBundle}=await import('../lib/research/risk-replay-bundle.ts');
const {persistEvidence}=await import('../lib/research/persist-evidence.ts');
hooks.deregister();
const bars=()=>Array.from({length:70},(_,i)=>({t:new Date(Date.UTC(2026,6,1+i,5)).toISOString(),c:100+i+(i%3),o:100,h:102,l:99,v:1000}));
const run=async(gap=false)=>{
 const calls=[];let lastCompleted=0;
 globalThis.__riskBars=async(symbol)=>{calls.push(symbol);await new Promise(resolve=>setTimeout(resolve,2));lastCompleted=Date.now();const data=bars();return symbol==='NVDA'&&gap?data.filter((_,i)=>i!==60):data;};
 const oldKey=process.env.MASSIVE_API_KEY;delete process.env.MASSIVE_API_KEY;
 try{return {result:await observedNetworkAndCrossAssetEvidence(new Date('2026-10-01T00:00:00Z')),calls,lastCompleted};}
 finally{if(oldKey!==undefined)process.env.MASSIVE_API_KEY=oldKey;delete globalThis.__riskBars;}
};
test('collector emits exact synchronized risk provenance with completion receipt time',async()=>{
 const {result,calls,lastCompleted}=await run();
 assert.ok(Date.parse(result.retrievedAt)>=lastCompleted);
 const risk=result.candidates.filter(x=>['beta','rolling_correlation','equity_bond_correlation'].includes(x.factor));
 assert.equal(risk.length,7);
 for(const row of risk){
  const n=row.factor==='beta'?60:20;
  assert.equal(row.metadata.sampleCount,n);assert.equal(row.metadata.sessionDates.length,n+1);
  assert.equal(row.availableAt,result.retrievedAt);assert.ok(Date.parse(row.availableAt)>=Date.parse(result.requestedAt));
  assert.equal(row.observedAt,bars().at(-1).t);assert.match(row.metadata.method,/synchronized_return_/);
  const {factor,subject,source,value,observedAt,availableAt}=row;
  assert.equal(checkRiskReplayBundle(row.metadata.riskReplay,{factor,subject,source,value,observedAt,availableAt}).status,'REPRODUCED');
  assert.equal(row.metadata.riskReplay.payload.inputWindow.own.length,n+1);
  assert.equal(row.metadata.riskReplay.payload.row.availableAt,result.retrievedAt);
  assert.equal(row.metadata.riskReplayInputs,undefined);
 }
 assert.equal(calls.filter(x=>x==='SPY').length,1);
});
test('collector omits mismatched NVDA risk while preserving valid peers',async()=>{
 const {result}=await run(true);
 assert.equal(result.candidates.filter(x=>x.subject==='NVDA'&&['beta','rolling_correlation'].includes(x.factor)).length,0);
 assert.equal(result.diagnostics.filter(x=>x.symbol==='NVDA'&&['beta','rolling_correlation'].includes(x.factor)).length,2);
 assert.ok(result.candidates.some(x=>x.subject==='AMD'&&x.factor==='beta'));
});

test('persistence serializes the complete bundle without database mutation during test',async()=>{
 const {result}=await run();
 const candidates=result.candidates.filter(x=>x.metadata?.riskReplay);
 const stored=[];
 globalThis.__riskReplaySql=async(strings,...values)=>{stored.push(JSON.parse(values.at(-1)));return [{id:stored.length}];};
 try{
  const receipt=await persistEvidence(candidates);
  assert.equal(receipt.saved,7);
  for(let i=0;i<stored.length;i++){
   assert.deepEqual(stored[i].riskReplay,candidates[i].metadata.riskReplay);
   const {factor,subject,source,value,observedAt,availableAt}=candidates[i];
   assert.equal(checkRiskReplayBundle(stored[i].riskReplay,{factor,subject,source,value,observedAt,availableAt}).status,'REPRODUCED');
  }
 }finally{delete globalThis.__riskReplaySql;}
});
