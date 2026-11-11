import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceQuoteOutcome as reference} from '../lib/research/quote-outcome-reference';
import {proposeQuoteOutcome,type FrozenQuote} from '../lib/research/proposed-quote-outcome';
const q=(id:string,quoteAt:string,receivedAt=quoteAt,bid=99):FrozenQuote=>({id,symbol:'TEST',sourceId:'Alpaca:iex',quoteAt,receivedAt,bid,ask:bid+2});
const base={forecastAt:'2030-01-02T14:00:00.000000001Z',horizonMs:1800000,asOf:'2030-01-02T14:46:00Z',frozenStart:q('entry','2030-01-02T13:59:00Z'),candidateSetComplete:true};
test('reference distinguishes quotes one nanosecond before and after exact horizon',()=>{
 const r=reference({...base,candidates:[q('before','2030-01-02T14:30:00.000000000Z'),q('after','2030-01-02T14:30:00.000000002Z')]});
 assert.equal(r.status,'REPRODUCIBLE_PROPOSAL');if(r.status==='REPRODUCIBLE_PROPOSAL')assert.equal(r.endpointId,'after');
});
test('reference rejects receipt a nanosecond beyond deadline, waits through exact grace',()=>{
 assert.equal(reference({...base,candidates:[q('end','2030-01-02T14:30:01Z','2030-01-02T14:45:00.000000002Z')]}).status,'VOID');
 assert.equal(reference({...base,asOf:'2030-01-02T14:45:00.000000001Z',candidates:[]}).status,'PENDING');
});
test('reference checks timezone equivalence, leap days, locked and conflicting markets',()=>{
 const common={...base,forecastAt:'2030-01-02T08:00:00-06:00'};
 assert.equal(reference({...common,candidates:[q('end','2030-01-02T09:30:00-05:00')]}).status,'REPRODUCIBLE_PROPOSAL');
 assert.equal(reference({...base,forecastAt:'2030-02-29T14:00:00Z',candidates:[]}).status,'UNVERIFIED');
 const locked={...base.frozenStart,bid:100,ask:100};
 const r=reference({...base,frozenStart:locked,candidates:[q('end','2030-01-02T14:31:00Z')]});if(r.status==='REPRODUCIBLE_PROPOSAL')assert.equal(r.quotedRoundTripCost,0);else assert.fail(r.status);
 assert.equal(reference({...base,candidates:[q('end','2030-01-02T14:31:00Z'),q('other','2030-01-02T14:31:00Z',undefined,100)]}).status,'UNVERIFIED');
});
test('separate implementation agrees on 100 deterministic synthetic candidate permutations',()=>{
 for(let n=0;n<100;n++){
  const input={...base,forecastAt:'2030-01-02T14:00:00Z',candidates:Array.from({length:12},(_,i)=>q('row'+i,new Date(Date.UTC(2030,0,2,14,29+i)).toISOString(),undefined,1+n+i))};
  if(n%2)input.candidates.reverse();
  const a=proposeQuoteOutcome(input),b=reference(input);assert.equal(a.status,b.status);
  if(a.status==='REPRODUCIBLE_PROPOSAL'&&b.status==='REPRODUCIBLE_PROPOSAL'){
   assert.equal(a.end.id,b.endpointId);assert.ok(Math.abs(a.realizedReturn-b.realizedReturn)<1e-12);
  }
 }
});
