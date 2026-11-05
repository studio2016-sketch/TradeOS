import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {fixture} from './fixtures/comparable-outcome-row.ts';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(['next/server','../../../lib/auth/server','../../../lib/db','../../../lib/research/prediction-outcome-ledger'].includes(specifier))return nextResolve(new URL('./fixtures/comparable-route-services.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const publicRoute=await import('../app/api/prospective-trial/route.ts');
const ownerRoute=await import('../app/api/scientific-validation/route.ts');
hooks.deregister();
const cohort=()=>[fixture(),{...fixture(true),baseline_id:'3',challenger_id:'4'},{...fixture(),baseline_id:'5',challenger_id:'6',baseline_notes:'legacy text'}];
async function run(route){
 const old=process.env.TRADEOS_OWNER_USER_ID;process.env.TRADEOS_OWNER_USER_ID='test-owner';
 const queries=[];
 globalThis.__comparableSql=async(strings,...values)=>{
  const query=strings.join('?');queries.push(query);
  if(query.includes('from neon_auth.'))return [{id:'test-owner',role:'admin',verified:true,banned:false}];
  if(query.includes('with b as')||query.includes('select b.observed_at'))return cohort();
  if(query.includes('forecast_total'))return [{forecast_total:2000,labelled_forecasts:1800,forecast_session_dates:20,immutable_records:2000,time_ordered_immutable_records:2000,future_dated_immutable_records:0,independently_timestamp_verified:0,publication_time_verified:0,acceleration_records:200,acceleration_session_dates:20,replay_trials:0,replay_cost_levels:0}];
  return [];
 };
 try{return {body:await (await route.GET()).json(),queries};}
 finally{delete globalThis.__comparableSql;if(old===undefined)delete process.env.TRADEOS_OWNER_USER_ID;else process.env.TRADEOS_OWNER_USER_ID=old;}
}
test('actual public route separates historical outcomes and exposes exclusions',async()=>{
 const {body,queries}=await run(publicRoute);
 assert.equal(body.trial.pairedCount,1);assert.equal(body.historicalReconstruction.pairedCount,1);assert.equal(body.pairing.excludedRows,1);
 assert.equal(body.trial.independentlyCertified,false);assert.equal(body.interpretation.absolutePredictiveClaim,false);
 assert.ok(queries.some(x=>x.includes('o1.notes baseline_notes')&&x.includes('f1.source_snapshot baseline_snapshot')&&x.includes('limit 10001')));
 assert.ok(queries.every(x=>!/^\s*(insert|update|delete)/i.test(x)));
});
test('actual owner assessment uses only bound comparable outcomes for prospective gates',async()=>{
 const {body,queries}=await run(ownerRoute);
 assert.equal(body.evidence.prospectivePairs,1);assert.equal(body.historicalReconstruction.pairedCount,1);assert.equal(body.pairing.excludedRows,1);
 assert.equal(body.assessment.gates.find(x=>x.id==='prospective_depth').state,'PRELIMINARY');
 assert.equal(body.assessment.liveExecutionAllowed,false);assert.equal(body.assessment.approvedModelInfluence,false);
 assert.ok(queries.some(x=>x.includes('b.notes baseline_notes')&&x.includes('b.source_snapshot baseline_snapshot')&&x.includes('limit 10001')));
});
