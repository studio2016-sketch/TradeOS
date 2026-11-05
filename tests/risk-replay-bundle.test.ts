import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRiskReplayBundle,checkRiskReplayBundle,RISK_IMPLEMENTATION_SHA256} from '../lib/research/risk-replay-bundle.ts';
import {synchronizedRiskStatistics} from '../lib/research/synchronized-risk-statistics.ts';
const bars=(n:number)=>Array.from({length:n+1},(_,i)=>({t:new Date(Date.UTC(2026,0,1+i)).toISOString(),c:100+i+(i%3)*0.25}));
function fixture(factor='beta'){
 const n=factor==='beta'?60:20,own=bars(n),benchmark=bars(n),risk=synchronizedRiskStatistics(own,benchmark,n)!;
 const row={factor,subject:factor==='equity_bond_correlation'?'SPY_TLT':'NVDA',source:'Alpaca:iex:1Day',value:factor==='beta'?risk.beta!:risk.correlation!,observedAt:risk.observedAt,availableAt:'2026-10-01T00:00:00.123Z'};
 const bundle=createRiskReplayBundle(row,risk.inputWindow,{ownSymbol:factor==='equity_bond_correlation'?'SPY':'NVDA',benchmarkSymbol:factor==='equity_bond_correlation'?'TLT':'SPY',feed:'iex'});
 return {bundle,row,own,benchmark,risk};
}
// Independent canonical encoding for mutations; digest consistency alone must not pass.
function signed(payload:any):any{const sorted=(v:any):any=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;return {payload,sha256:createHash('sha256').update(JSON.stringify(sorted(payload))).digest('hex')};}
test('implementation identity matches actual helper bytes, not just a version label',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../lib/research/synchronized-risk-statistics.ts',import.meta.url))).digest('hex'),RISK_IMPLEMENTATION_SHA256);
});
test('all supported metrics round-trip stored JSON and reordered JSONB keys without certification',()=>{
 for(const factor of ['beta','rolling_correlation','equity_bond_correlation']){
  const {bundle,row}=fixture(factor);
  const reverse=(v:any):any=>Array.isArray(v)?v.map(reverse):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reverse(v[k])])):v;
  assert.deepEqual(checkRiskReplayBundle(reverse(JSON.parse(JSON.stringify(bundle))),row),{status:'REPRODUCED',reason:'SAME_IMPLEMENTATION_ARITHMETIC_ONLY',certified:false});
  assert.ok(JSON.stringify(bundle).length<10000);
 }
});
test('snapshot captures exact selected prices and timestamps without mutable aliases or rounding',()=>{
 const {bundle,risk,row}=fixture();
 assert.deepEqual(bundle.payload.inputWindow,risk.inputWindow);
 risk.inputWindow.own[0].c=999;
 assert.notEqual(bundle.payload.inputWindow.own[0].c,999);
 assert.equal(checkRiskReplayBundle(bundle,row).status,'REPRODUCED');
});
test('legacy, unknown implementation, corrupt digest, changed input, output, identity and detached row fail',()=>{
 const {bundle,row}=fixture();
 assert.equal(checkRiskReplayBundle(undefined,row).status,'UNVERIFIED');
 for(const change of [
  (p:any)=>{p.implementation.sha256='0'.repeat(64);},
  (p:any)=>{p.inputWindow.own[0].c+=1;},
  (p:any)=>{p.row.value+=1;},
  (p:any)=>{p.identity.benchmarkSymbol='QQQ';},
  (p:any)=>{p.inputPolicy.adjustment='raw';},
  (p:any)=>{p.inputWindow.own.pop();},
  (p:any)=>{p.inputWindow.own[1].t=p.inputWindow.own[0].t;}
 ]){const p=structuredClone(bundle.payload);change(p);assert.equal(checkRiskReplayBundle(signed(p),row).status,'UNVERIFIED');}
 assert.equal(checkRiskReplayBundle({...bundle,sha256:'bad'},row).status,'UNVERIFIED');
 assert.equal(checkRiskReplayBundle(bundle,{...row,subject:'AMD'}).status,'UNVERIFIED');
 assert.equal(checkRiskReplayBundle(bundle,{...row,availableAt:'2026-10-02T00:00:00Z'}).status,'UNVERIFIED');
});
test('nonfinite inputs and impossible receipt cannot receive reproduced status',()=>{
 const {bundle,row,risk}=fixture();
 assert.throws(()=>createRiskReplayBundle(row,{...risk.inputWindow,own:[{t:'bad',c:NaN}]},{ownSymbol:'NVDA',benchmarkSymbol:'SPY',feed:'iex'}));
 const badRow={...row,availableAt:'2020-01-01T00:00:00Z'};
 const bad=createRiskReplayBundle(badRow,risk.inputWindow,{ownSymbol:'NVDA',benchmarkSymbol:'SPY',feed:'iex'});
 assert.equal(checkRiskReplayBundle(bad,badRow).reason,'INVALID_RECEIPT_TIME');
});

test('reproducible bundle does not promote the factor audit engineering or trading gates',async()=>{
 const {auditFactorVerification}=await import('../lib/research/factor-verification.ts');
 const {bundle,row}=fixture();
 assert.equal(checkRiskReplayBundle(bundle,row).status,'REPRODUCED');
 const result=auditFactorVerification([{factorKey:'beta',observations:5,subjects:1,sources:[row.source],sourceTimeEligibleObservations:5,latestAvailableAt:row.availableAt,chronologyOk:true,finiteOk:true,implementationMethods:['synchronized_return_covariance_over_variance_v2']}],[],row.availableAt);
 const beta=result.factors.find((x:any)=>x.key==='beta')!;
 assert.equal(beta.status,'MEASURED_UNVERIFIED');assert.equal(beta.gates.implementationEvidenceLinked,false);assert.equal(beta.modelInfluenceAllowed,false);
});
