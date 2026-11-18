import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {fixture} from './fixtures/comparable-outcome-row.ts';
import {COMPARABLE_PAIR_POLICY} from '../lib/research/comparable-pair-reader.ts';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(['/lib/db','/lib/cron','/lib/research/collector-receipts'].some(x=>specifier.endsWith(x)))return nextResolve(new URL('./fixtures/legacy-pairing-services.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {GET:phase4}=await import('../app/api/cron/phase4-validation/route.ts');
const {GET:phase5}=await import('../app/api/cron/phase5-validation/route.ts');
const {privateGET:certification}=await import('../lib/operations/internal-audit-models/research-certification.ts');
test('legacy consumers use strict comparable pairs and expose exclusions without changing evidence',async()=>{
 try{
  for(const handler of [phase4,phase5,certification]){
   const valid=fixture(),historic={...fixture(true),baseline_id:'3',challenger_id:'4'};
   const f=globalThis.__legacyPairing={authorized:true,pairs:[valid,historic,{...valid,challenger_id:'5'}],phase4:{gate:{passed:true}},queries:[],writes:[]};
   const response=await handler(new Request('https://fixture.invalid'));assert.equal(response.status,200);
   const body=await response.json();
   assert.equal(body.pairingPolicy,COMPARABLE_PAIR_POLICY);assert.equal(body.pairing.prospectivePairs,0);
   assert.equal(body.pairing.exclusions.AMBIGUOUS_REUSED_FORECAST,2);assert.equal(body.historicalReconstruction.pairs,1);
   assert.equal(body.historicalReconstruction.eligibleForProspectiveDepth,false);
   assert.equal((body.paired??body.pairedValidation).pairs,0);
   if(handler===certification){assert.equal(body.certified,false);assert.equal(body.modelPromotionAllowed,false);}
   assert.ok(f.queries.filter(q=>!q.trim().startsWith('insert')).every(q=>/^\s*(select|with)\b/.test(q)));
   assert.ok(f.writes.every(w=>w.query.includes('audit_events')),'only preexisting audit write path mocked');
  }
  for(const policy of [undefined,'legacy',COMPARABLE_PAIR_POLICY]){
   globalThis.__legacyPairing={authorized:true,pairs:[],phase4:{gate:{passed:true},pairingPolicy:policy},queries:[],writes:[]};
   const body=await (await phase5(new Request('https://fixture.invalid'))).json();
   assert.equal(body.phase4SnapshotCompatible,policy===COMPARABLE_PAIR_POLICY);
   const check=body.gate.checks.find(c=>c.id==='phase4_foundation');
   assert.ok(check);assert.equal(check.pass,policy===COMPARABLE_PAIR_POLICY);
  }
  for(const handler of [phase4,phase5]){
   const f=globalThis.__legacyPairing={authorized:false,pairs:[],queries:[],writes:[]};
   assert.equal((await handler(new Request('https://fixture.invalid'))).status,401);assert.equal(f.queries.length,0);
  }
 }finally{delete globalThis.__legacyPairing;hooks.deregister();}
});
