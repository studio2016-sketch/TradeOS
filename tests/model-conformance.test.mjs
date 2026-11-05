import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const moduleUrl=new URL('./fixtures/model-conformance-services.mjs',import.meta.url).href;
const hooks=registerHooks({resolve(specifier,context,nextResolve){if(specifier==='../db')return nextResolve(moduleUrl,context);return nextResolve(specifier,context);}});
const {certifiedModelVersions,certifyFactor}=await import('../lib/research/certification.ts');
hooks.deregister();

test('positive outcome-derived scorecards and independent flags cannot enable ingest model validation',async()=>{
 const row={model_version:'synthetic-v3',sample_count:300,brier_score:.1,drift_score:.01,status:'CERTIFIED'};
 globalThis.__modelConformanceSql=async(strings)=>strings.join('').includes('model_scorecards')?[row]:[{payload:{independentSources:['test-a','test-b'],untouchedHoldout:true,prospective:true,sampleCount:300,pointInTimeVerified:true,costsVerified:true,independentReplayVerified:true}}];
 try{
  const [result]=await certifiedModelVersions();
  assert.equal(result.modelEligible,false);assert.equal(result.certification,'RESEARCH_ONLY');
  assert.equal(result.gates.outcomeProtocolConformance,false);
  assert.ok(Object.entries(result.gates).filter(([k])=>k!=='outcomeProtocolConformance').every(([,v])=>v));
  assert.equal(result.sample_count,300);assert.equal(result.brier_score,.1);assert.equal(result.prospectiveSamples,300);
  assert.equal(row.status,'CERTIFIED');assert.equal(result.protocolConformance.status,'BLOCKED');
 }finally{delete globalThis.__modelConformanceSql;}
});

test('separate factor validation is not blanket-blocked without outcome lineage',async()=>{
 globalThis.__modelConformanceSql=async()=>[{payload:{prospective:true,untouchedHoldout:true,sampleCount:300,brier:.1,drift:.01,pointInTimeVerified:true,costsVerified:true,independentReplayVerified:true}}];
 try{const result=await certifyFactor({id:'synthetic-factor',sourceCount:2});assert.equal(result.modelEligible,true);}
 finally{delete globalThis.__modelConformanceSql;}
});
