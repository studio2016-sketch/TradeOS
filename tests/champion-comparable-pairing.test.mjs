import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {selectComparableProspectivePairs} from '../lib/research/comparable-prospective-pairs.ts';
import {fixture} from './fixtures/comparable-outcome-row.ts';
const hooks=registerHooks({resolve(specifier,context,nextResolve){if(specifier==='../db')return nextResolve(new URL('./fixtures/shadow-comparison-db.mjs',import.meta.url).href,context);return nextResolve(specifier,context);}});
const {championChallengerEvaluation}=await import('../lib/research/championChallenger.ts');
async function evaluate(pairs){globalThis.__shadowComparison={rows:[],pairs,calls:[]};return championChallengerEvaluation();}
test('shadow comparison uses unique protocol-bound pairs and transparent exclusions',async()=>{
 try{
  const valid=fixture(),historic={...fixture(true),baseline_id:'3',challenger_id:'4'},bad={...fixture(),baseline_id:'5',challenger_id:'6',baseline_outcome:false};
  const before=JSON.stringify([valid,historic,bad]);
  const r=await evaluate([valid,historic,bad]);
  assert.equal(r.matchedSamples,1);assert.equal(r.historicalReconstruction.pairs,1);assert.equal(r.historicalReconstruction.eligibleForProspectiveDepth,false);
  assert.equal(r.pairing.excludedRows,1);assert.equal(r.outcomeDisagreements,1);
  assert.ok(Math.abs(r.pairedValidation.meanImprovement-((.55-1)**2-(.58-1)**2))<1e-12);
  assert.equal(r.result,'INSUFFICIENT_PROSPECTIVE_DATA');assert.equal(r.promotionAllowed,false);
  assert.equal(JSON.stringify([valid,historic,bad]),before);
  assert.match(globalThis.__shadowComparison.calls[1].query,/limit 10001/);
  const query=globalThis.__shadowComparison.calls[1],pg=new PGlite();
  try{
   await pg.exec('create table forecast_ledger(id int, created_at timestamptz, symbol text, model_version text, horizon text, direction text, probability double precision, source_snapshot jsonb); create table forecast_outcomes(forecast_id int, was_correct boolean, realized_return double precision, notes jsonb);');
   for(const [id,side,model] of [[1,'baseline',query.values[0]],[2,'challenger',query.values[2]],[3,'baseline',query.values[0]]]){
    await pg.query('insert into forecast_ledger values($1,$2,$3,$4,$5,$6,$7,$8)',[id,valid[side+'_created_at'],valid.symbol,model,valid[side+'_horizon'],valid[side+'_direction'],valid[side+'_probability'],JSON.stringify(valid[side+'_snapshot'])]);
    await pg.query('insert into forecast_outcomes values($1,$2,$3,$4)',[id,valid[side+'_outcome'],valid[side+'_return'],valid[side+'_notes']]);
   }
   let i=0;const actual=await pg.query(query.query.replace(/\?/g,()=>'$'+(++i)),query.values);
   assert.equal(actual.rows.length,2,'actual SQL exposes ambiguous matches, never chooses a convenient winner');
   const excluded=selectComparableProspectivePairs(actual.rows);assert.equal(excluded.prospectivePairs.length,0);assert.equal(excluded.diagnostics.exclusions.AMBIGUOUS_REUSED_FORECAST,2);
   await pg.exec('delete from forecast_outcomes where forecast_id=3; delete from forecast_ledger where id=3');
   i=0;const unique=await pg.query(query.query.replace(/\?/g,()=>'$'+(++i)),query.values);
   assert.equal(selectComparableProspectivePairs(unique.rows).prospectivePairs.length,1);
  }finally{await pg.close();}

  assert.ok(globalThis.__shadowComparison.calls.every(c=>/^\s*(select|with)\b/i.test(c.query)));
  for(const rows of [[valid,{...valid,challenger_id:'7'}],[{...valid,challenger_direction:'bearish'}],[{...valid,baseline_notes:'legacy'}]]){
   const out=await evaluate(rows);assert.equal(out.matchedSamples,0);assert.equal(out.promotionAllowed,false);assert.equal(out.result,'INSUFFICIENT_PROSPECTIVE_DATA');assert.equal(out.pairing.excludedRows,rows.length);
  }
  const truncated=await evaluate(Array.from({length:10001},()=>valid));
  assert.equal(truncated.matchedSamples,0);assert.equal(truncated.pairing.candidateSetComplete,false);
  const empty=await evaluate([]);assert.equal(empty.matchedSamples,0);assert.equal(empty.pairedValidation.meanImprovement,null);
 }finally{delete globalThis.__shadowComparison;hooks.deregister();}
});
