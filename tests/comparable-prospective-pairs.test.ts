import test from 'node:test';
import assert from 'node:assert/strict';
import {selectComparableProspectivePairs as select} from '../lib/research/comparable-prospective-pairs.ts';
import {fixture} from './fixtures/comparable-outcome-row.ts';

function note(row:any,side:string,change:(n:any)=>void){const n=JSON.parse(row[side+'_notes']);change(n);row[side+'_notes']=JSON.stringify(n);}
test('matching bound pairs and historical reconstruction stay in separate cohorts',()=>{
 const a=fixture(),b={...fixture(true),baseline_id:'3',challenger_id:'4'},before=JSON.stringify([a,b]);
 const r=select([a,b]);assert.equal(r.prospectivePairs.length,1);assert.equal(r.reconstructedPairs.length,1);assert.equal(r.diagnostics.excludedRows,0);assert.equal(r.diagnostics.independentlyCertified,false);assert.equal(JSON.stringify([a,b]),before);
});
test('same boolean result does not establish common source observations, returns or costs',()=>{
 for(const mutate of [
  (r:any)=>note(r,'baseline',n=>n.startObservationTime='2026-11-05T13:59:58.000Z'),
  (r:any)=>note(r,'baseline',n=>n.evaluationObservationTime='2026-11-05T14:31:00.000Z'),
  (r:any)=>note(r,'baseline',n=>n.sourceId='Alpaca:sip'),
  (r:any)=>{r.baseline_return='.003';},
  (r:any)=>note(r,'baseline',n=>n.quotedRoundTripCost=.0003),
  (r:any)=>note(r,'baseline',n=>n.minimumNetEdge=.0009),
 ]){const r=fixture();mutate(r);const out=select([r]);assert.equal(out.prospectivePairs.length,0);assert.equal(out.diagnostics.excludedRows,1);}
});
test('equal but incorrectly graded labels are rejected instead of rewritten',()=>{
 const row=fixture();row.baseline_return=row.challenger_return='0.0001';
 const out=select([row]);assert.equal(out.diagnostics.exclusions.OUTCOME_LABEL_NOT_REPRODUCIBLE,1);assert.equal(row.baseline_outcome,true);
});
test('missing legacy notes, unequal protocol bindings and mixed cohorts fail closed',()=>{
 for(const mutate of [(r:any)=>{r.baseline_notes='legacy text';},(r:any)=>{r.baseline_snapshot={};},(r:any)=>{r.baseline_notes=fixture(true).baseline_notes;},(r:any)=>note(r,'baseline',n=>n.protocolFingerprint='0'.repeat(64))]){const r=fixture();mutate(r);assert.equal(select([r]).diagnostics.excludedRows,1);}
});
test('ambiguous joins cannot multiply the same forecast into multiple observations',()=>{
 const r=fixture();const out=select([r,{...r,challenger_id:'3'}]);assert.equal(out.prospectivePairs.length,0);assert.equal(out.diagnostics.exclusions.AMBIGUOUS_REUSED_FORECAST,2);
 assert.equal(select([{...r,challenger_id:'1'}]).diagnostics.exclusions.INVALID_PAIR_IDENTIFIERS,1);
 assert.equal(select([r,{...r,baseline_id:'2',challenger_id:'3'}]).diagnostics.exclusions.AMBIGUOUS_REUSED_FORECAST,2);
});
test('frozen chronology and horizons are enforced for both forecasts',()=>{
 for(const mutate of [
  (r:any)=>{r.challenger_horizon='1h';},(r:any)=>{r.challenger_direction='bearish';},
  (r:any)=>{r.baseline_created_at='2026-11-05T13:59:00Z';},
  (r:any)=>{r.challenger_created_at='2026-11-05T14:01:00Z';},
  (r:any)=>{r.observed_at='2026-11-05T14:01:00Z';},
  (r:any)=>{for(const side of ['baseline','challenger'])note(r,side,n=>n.startObservationTime='2026-11-05T13:50:00Z');},
 ]){const r=fixture();mutate(r);assert.equal(select([r]).diagnostics.excludedRows,1);}
});
test('invalid numeric/boolean fields do not coerce into comparable data',()=>{
 for(const value of [null,true,[],{},'','0x10',Infinity]){const r:any=fixture();r.baseline_return=r.challenger_return=value;assert.equal(select([r]).diagnostics.excludedRows,1);}
 const r:any=fixture();r.baseline_outcome=r.challenger_outcome='true';assert.equal(select([r]).diagnostics.excludedRows,1);
});
test('synthetic historical pair with unequal entry observations is excluded',()=>{
 const r=fixture(true);r.baseline_id='11';r.challenger_id='12';r.baseline_outcome=r.challenger_outcome=false;r.baseline_return='0.0001';r.challenger_return='0.0002';
 note(r,'baseline',n=>{n.startObservationTime='2026-11-05T13:59:58.000Z';n.evaluationObservationTime='2026-11-05T14:30:01.000Z';n.outcomeDisposition='FAIL';});
 note(r,'challenger',n=>{n.startObservationTime='2026-11-05T13:59:59.000Z';n.evaluationObservationTime='2026-11-05T14:30:01.000Z';n.outcomeDisposition='FAIL';});
 assert.equal(select([r]).diagnostics.exclusions.DIFFERENT_OR_MISSING_OUTCOME_OBSERVATIONS,1);
});

test('contradictory or unknown outcome evidence classes cannot acquire prospective status',()=>{
 for(const label of ['HISTORICAL_RECONSTRUCTION','CERTIFIED','PROSPECTIVE']){
  const r=fixture();for(const side of ['baseline','challenger'])note(r,side,n=>n.evidenceClass=label);
  const result=select([r]);assert.equal(result.prospectivePairs.length,0);assert.equal(result.diagnostics.exclusions.UNMATCHED_OUTCOME_PROTOCOL,1);
 }
});
test('sentinel over candidate cap fails closed before assessing ambiguous partial cohorts',()=>{
 const result=select(Array.from({length:10001},()=>fixture()));
 assert.equal(result.prospectivePairs.length,0);assert.equal(result.reconstructedPairs.length,0);assert.equal(result.diagnostics.candidateSetComplete,false);assert.equal(result.outcomeDisagreements,null);
 assert.equal(result.diagnostics.exclusions.CANDIDATE_LIMIT_EXCEEDED,10001);
});
