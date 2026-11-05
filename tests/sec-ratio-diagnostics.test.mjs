import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(['../market/sec','../market/live','../db'].includes(specifier))return nextResolve(new URL('./fixtures/sec-ratio-dependencies.mjs',import.meta.url).href,context);
 if(specifier==='./aligned-cashflow-yield')return nextResolve(specifier+'.ts',context);
 return nextResolve(specifier,context);
}});
const {secRatioEvidence,secRatioEvidenceWithDiagnostics}=await import('../lib/research/sec-ratio-evidence.ts');
hooks.deregister();
const p={start:'2025-01-01',end:'2025-12-31',filed:'2026-02-05',accession:'fixture-2026'};
function setup(){
 const filing={status:'ok',values:{shares:100,annual_operating_cash_flow:150,annual_capex:40},provenance:{annual_operating_cash_flow:p,annual_capex:p}};
 const mocks={fundamentals:async()=>filing,catalysts:async()=>({catalysts:[],statuses:[]}),query:async()=>[],snapshots:async()=>({snapshots:[{price:10,timestamp:'2026-11-05T16:25:00Z',source:'fixture'}]})};
 globalThis.__secRatioMocks=mocks;return {filing,mocks};
}
const now=new Date('2026-11-05T16:25:10Z');
test('missing current shares blocks valuation, with an explicit reason rather than fabricated shares',async()=>{
 const {filing}=setup();delete filing.values.shares;
 const result=await secRatioEvidenceWithDiagnostics('META',now);
 assert.equal(result.evidence.length,0);
 assert.deepEqual(result.diagnostics,[{stage:'market_cap_ratios',reason:'current_common_shares_missing_or_invalid'}]);
});
test('aligned cashflow arithmetic and legacy array API remain unchanged',async()=>{
 setup();const result=await secRatioEvidenceWithDiagnostics('TEST',now);
 assert.deepEqual(result.diagnostics,[]);assert.equal(result.evidence.length,1);
 assert.equal(result.evidence[0].value,.11);assert.equal(result.evidence[0].metadata.backtestEligible,false);
 assert.equal(result.evidence[0].metadata.timestampKind,'retrieval_completion_not_original_publication');
 const legacy=await secRatioEvidence('TEST',now);assert.ok(Array.isArray(legacy));assert.equal(legacy[0].value,.11);
});
test('mismatched filing and missing price yield distinct omission reasons',async()=>{
 const {filing}=setup();filing.provenance.annual_capex={...p,start:'2011-01-01',end:'2011-12-31'};
 const mismatch=await secRatioEvidenceWithDiagnostics('TEST',now);
 assert.equal(mismatch.evidence.length,0);assert.equal(mismatch.diagnostics[0].reason,'cashflow_inputs_missing_invalid_or_unaligned');
 const {mocks}=setup();mocks.snapshots=async()=>({snapshots:[]});
 const price=await secRatioEvidenceWithDiagnostics('TEST',now);
 assert.equal(price.evidence.length,0);assert.equal(price.diagnostics[0].reason,'market_price_missing_or_invalid');
});
test('provider and valuation failures are reported without leaking exception content',async()=>{
 const {filing}=setup();filing.status='http_error';
 assert.deepEqual((await secRatioEvidenceWithDiagnostics('TEST',now)).diagnostics,[{stage:'company_facts',reason:'http_error'}]);
 const {mocks}=setup();mocks.query=async()=>{throw new Error('sensitive upstream detail')};
 const result=await secRatioEvidenceWithDiagnostics('TEST',now);
 assert.deepEqual(result.diagnostics,[{stage:'valuation_collection',reason:'collection_failed'}]);
 assert.ok(!JSON.stringify(result).includes('sensitive upstream detail'));
});
test('scheduled receipt persists diagnostics alongside unchanged evidence totals',()=>{
 const route=readFileSync(new URL('../app/api/cron/sec-fundamental-evidence/route.ts',import.meta.url),'utf8');
 assert.match(route,/const \{evidence,diagnostics\}=await secRatioEvidenceWithDiagnostics\(symbol\)/);
 assert.match(route,/saved:persisted.saved,diagnostics/);
 assert.match(route,/details:\{selected,results\}/);
});
