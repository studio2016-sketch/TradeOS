import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeQuoteOutcome as run,type FrozenQuote} from '../lib/research/proposed-quote-outcome.ts';
const at=(minutes:number)=>new Date(Date.UTC(2030,0,2,14,0)+minutes*60_000).toISOString();
const q=(id:string,minute:number,bid=99,ask=101,sourceId='fixture-feed'):FrozenQuote=>({id,symbol:'TEST',sourceId,quoteAt:at(minute),receivedAt:at(minute),bid,ask});
const fixture=()=>({forecastAt:at(0),horizonMs:30*60_000,asOf:at(46),frozenStart:q('entry',-1),candidates:[q('end',30,109,111)],candidateSetComplete:true});
test('uses frozen quote midpoint and preserves raw evidence without activating policy',()=>{
 const x=fixture(),before=JSON.stringify(x),r=run(x);
 assert.equal(r.status,'REPRODUCIBLE_PROPOSAL');
 if(r.status!=='REPRODUCIBLE_PROPOSAL')throw Error('expected result');
 assert.equal(r.realizedReturn,.1);assert.equal(r.quotedRoundTripCost,.02);assert.deepEqual(r.start,x.frozenStart);assert.deepEqual(r.end,x.candidates[0]);
 assert.equal(r.activated,false);assert.equal(r.sourceTimeCertified,false);assert.equal(r.eligibleForLive,false);assert.equal(JSON.stringify(x),before);
});
test('rejects entry received after forecast even when quote predates it',()=>{const x=fixture();x.frozenStart.receivedAt=at(1);assert.equal(run(x).status,'UNVERIFIED');});
test('fresh trade metadata cannot rescue stale or missing quote time',()=>{
 const x=fixture();x.frozenStart.quoteAt=at(-6);Object.assign(x.frozenStart,{timestamp:at(0),price:100});assert.equal(run(x).status,'UNVERIFIED');
 x.frozenStart.quoteAt='';assert.equal(run(x).status,'UNVERIFIED');
});
test('never changes frozen source or symbol to obtain a future endpoint',()=>{
 const x=fixture();x.candidates=[q('other',30,109,111,'alternate'),{...q('symbol',30),symbol:'OTHER'}];assert.equal(run(x).status,'VOID');
});
test('uses quote time and earliest endpoint, independent of input order and trade price',()=>{
 const x=fixture();x.candidates=[q('late',31,119,121),q('early',30,109,111)];Object.assign(x.candidates[1],{price:999,timestamp:at(44)});
 const r=run(x);assert.equal(r.status,'REPRODUCIBLE_PROPOSAL');if(r.status==='REPRODUCIBLE_PROPOSAL'){assert.equal(r.end.id,'early');assert.equal(r.realizedReturn,.1);}
 assert.deepEqual(run({...x,candidates:[...x.candidates].reverse()}),r);
});
test('requires complete candidate set rather than treating a truncated query as proof',()=>{assert.equal(run({...fixture(),candidateSetComplete:false}).status,'UNVERIFIED');});
test('receipt and quote must both fit grace; exact boundary accepted',()=>{
 const x=fixture();x.candidates=[q('boundary',45)];assert.equal(run(x).status,'REPRODUCIBLE_PROPOSAL');
 x.candidates[0].receivedAt=at(45.001);assert.equal(run(x).status,'VOID');
 x.candidates=[q('after',45.001)];assert.equal(run(x).status,'VOID');
});
test('does not consume future receipts; missing endpoint is pending through deadline',()=>{
 const x=fixture();x.asOf=at(30);x.candidates[0].receivedAt=at(31);assert.equal(run(x).status,'PENDING');
 x.candidates=[];x.asOf=at(45);assert.equal(run(x).status,'PENDING');x.asOf=at(45.001);assert.equal(run(x).status,'VOID');
});
test('conflicting duplicate IDs or same-time quote revisions fail closed',()=>{
 const x=fixture();x.candidates.push({...x.candidates[0],ask:112});assert.equal(run(x).status,'UNVERIFIED');
 x.candidates=[q('a',30),q('b',30,98,102)];assert.equal(run(x).status,'UNVERIFIED');
});
test('identical same-time quotes have deterministic receipt and ID tie handling',()=>{
 const x=fixture();x.candidates=[q('z',30),q('a',30),{...q('earlier-receipt',30),receivedAt:at(31)}];
 const r=run(x);assert.equal(r.status,'REPRODUCIBLE_PROPOSAL');if(r.status==='REPRODUCIBLE_PROPOSAL')assert.equal(r.end.id,'a');
});
test('invalid numeric, crossed, missing or impossible quote chronology is rejected; locked quotes allowed',()=>{
 for(const patch of [{bid:NaN},{ask:Infinity},{bid:0},{bid:112},{quoteAt:'bad'},{receivedAt:at(29)},{bid:true as any}]){const x=fixture();Object.assign(x.candidates[0],patch);assert.equal(run(x).status,'UNVERIFIED');}
 const x=fixture();x.frozenStart.bid=x.frozenStart.ask=100;assert.equal(run(x).status,'REPRODUCIBLE_PROPOSAL');
});
test('invalid horizon or as-of chronology fails closed',()=>{for(const horizonMs of [0,-1,Infinity,1.5])assert.equal(run({...fixture(),horizonMs}).status,'UNVERIFIED');assert.equal(run({...fixture(),asOf:at(-1)}).status,'UNVERIFIED');});

test('future-received revisions do not affect an earlier as-of result',()=>{
 const x=fixture();x.candidates.push({...q('future',30,100,120),receivedAt:at(47)});
 assert.deepEqual(run(x),run(fixture()));
});
test('no endpoint becomes terminal until receipt window closes',()=>{
 const x=fixture();x.asOf=at(31);x.candidates=[q('visible',31,119,121),{...q('earlier',30,109,111),receivedAt:at(32)}];
 assert.equal(run(x).status,'PENDING');x.asOf=at(32);assert.equal(run(x).status,'PENDING');
 x.asOf=at(46);const r=run(x);assert.equal(r.status,'REPRODUCIBLE_PROPOSAL');if(r.status==='REPRODUCIBLE_PROPOSAL')assert.equal(r.end.id,'earlier');
});

test('after-cutoff revisions never change a finalized selection at a later as-of time',()=>{
 const x=fixture();x.candidates.push({...q('late-revision',30,100,120),receivedAt:at(47)});x.asOf=at(48);
 assert.deepEqual(run(x),run({...fixture(),asOf:at(48)}));
});
