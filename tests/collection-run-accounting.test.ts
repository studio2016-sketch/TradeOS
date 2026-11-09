import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionRunAccounting,parseCollectionRunAccounting} from '../lib/research/collection-run-accounting';
import {evidenceTimestamp} from '../lib/research/evidence-time';
import {marketPersistenceDiagnostics} from '../lib/market/persistence-diagnostics';
import type {MarketSnapshot} from '../lib/market/types';

const horizon=evidenceTimestamp('2026-11-06T21:30:00Z')!,deadline=evidenceTimestamp('2026-11-06T21:45:00Z')!;
function fixture(){
 const marketSelection=[{symbol:'TEST',sourceId:'Alpaca:iex',priceAt:'2026-11-06T21:00:00Z',quoteAt:'2026-11-06T21:31:00Z',selectionEligible:true,selected:false},
  {symbol:'TEST',sourceId:'Alpaca:delayed_sip',priceAt:'2026-11-06T21:15:00Z',quoteAt:'2026-11-06T21:15:00Z',selectionEligible:true,selected:true}];
 const snap={symbol:'TEST',source:'Alpaca:delayed_sip',timestamp:marketSelection[1].priceAt,quoteTimestamp:marketSelection[1].quoteAt} as MarketSnapshot;
 const marketPersistence=marketPersistenceDiagnostics(['TEST'],[snap],[{symbol:'TEST',source:snap.source,saved:true}]);
 return {finishedAt:'2026-11-06T21:35:01Z',marketSelection,marketPersistence};
}
const account=(runs:Parameters<typeof collectionRunAccounting>[0])=>collectionRunAccounting(runs,'TEST','Alpaca:iex',horizon,deadline);

test('read actual persistence summary shape and identify an unselected horizon-window IEX candidate',()=>{
 const run=fixture(),before=JSON.stringify(run),r=account([run]);
 assert.equal(r.status,'AVAILABLE');assert.equal(r.counts?.windowQuoteCandidatesNotSelected,1);
 assert.equal(r.counts?.matchingSourceSelectedInserted,0);assert.equal(r.counts?.preHorizonQuoteCandidates,0);
 assert.equal(JSON.stringify(run),before);
});
test('legacy and partial telemetry remain unknown, with explicit partial coverage for mixed runs',()=>{
 const legacy={finishedAt:fixture().finishedAt},r=account([legacy]);
 assert.equal(r.status,'UNAVAILABLE');assert.equal(r.counts,null);assert.equal(r.runsWithoutTelemetry,1);
 assert.equal(account([{...legacy,marketSelection:null,marketPersistence:null}]).counts,null);
 assert.equal(parseCollectionRunAccounting({...legacy,marketSelection:fixture().marketSelection}).status,'PARTIAL');
 const mixed=account([legacy,fixture()]);assert.equal(mixed.status,'PARTIAL');assert.equal(mixed.runsWithTelemetry,1);
 assert.equal(mixed.counts?.windowQuoteCandidatesNotSelected,1);
});
test('stale and unknown or future quote timestamps stay distinct at nanosecond precision',()=>{
 const run=fixture();
 run.marketSelection[0].quoteAt='2026-11-06T21:29:59.999999999Z';assert.equal(account([run]).counts?.preHorizonQuoteCandidates,1);
 run.marketSelection[0].quoteAt='2026-11-06T21:30:00Z';assert.equal(account([run]).counts?.windowQuoteCandidatesNotSelected,1);
 run.marketSelection[0].quoteAt='2026-11-06T21:35:01.000000001Z';assert.equal(account([run]).counts?.unknownOrFutureQuoteCandidates,1);
 run.marketSelection[0].quoteAt='not-a-time';assert.equal(account([run]).counts?.unknownOrFutureQuoteCandidates,1);
 run.finishedAt='2026-11-06T21:50:00Z';run.marketSelection[0].quoteAt='2026-11-06T21:45:00Z';assert.equal(account([run]).counts?.windowQuoteCandidatesNotSelected,1);
 run.marketSelection[0].quoteAt='2026-11-06T21:45:00.000000001Z';assert.equal(account([run]).counts?.windowQuoteCandidatesNotSelected,0);
});
test('selected IEX insert, conflict and unfinished writes remain distinct and source-bound',()=>{
 for(const [status,key] of [['INSERTED','matchingSourceSelectedInserted'],['CONFLICT_NO_INSERT','matchingSourceSelectedConflicts'],['NOT_COMPLETED','matchingSourceSelectedNotCompleted']] as const){
  const run=fixture();run.marketSelection[0].selected=true;run.marketSelection[1].selected=false;
  const c=run.marketSelection[0];run.marketPersistence.selected=[{symbol:c.symbol,sourceId:c.sourceId,priceAt:c.priceAt,quoteAt:c.quoteAt,persistence:status}];
  const r=account([run]);assert.equal(r.status,'AVAILABLE');assert.equal(r.counts?.[key],1);assert.equal(r.counts?.windowQuoteCandidatesNotSelected,0);
 }
 const unrelated=fixture();unrelated.marketSelection[0].symbol='OTHER';assert.equal(account([unrelated]).counts?.matchingSourceCandidates,0);
});
test('contradictory selected-source, timestamps and winner counts fail closed',()=>{
 const x=fixture();x.marketPersistence.selected[0].sourceId='Alpaca:iex';assert.equal(account([x]).status,'INVALID');
 const y=fixture();y.marketPersistence.selected[0].quoteAt='2026-11-06T21:16:00Z';assert.equal(parseCollectionRunAccounting(y).status,'INVALID');
 const z=fixture();z.marketSelection[0].selected=true;assert.equal(parseCollectionRunAccounting(z).status,'INVALID');
 const ineligible=fixture();ineligible.marketSelection[1].selectionEligible=false;assert.equal(parseCollectionRunAccounting(ineligible).status,'INVALID');
});
test('malformed partial telemetry, unknown schemas and bounded exports cannot hide invalid attribution',()=>{
 const base={finishedAt:fixture().finishedAt};
 for(const r of [{...base,marketSelection:[null]}, {...base,marketSelection:{}}, {...fixture(),marketPersistence:{schema:'unknown',selected:[]}},
  {...fixture(),marketSelection:Array(151).fill(fixture().marketSelection[0])}, {...fixture(),finishedAt:'invalid'}]){
  assert.equal(parseCollectionRunAccounting(r).status,'INVALID');assert.equal(account([r]).counts,null);
 }
});
