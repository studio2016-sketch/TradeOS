import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionTraceDiagnostics} from '../lib/research/collection-trace-diagnostics';
import {captureProposedEntry} from '../lib/research/proposed-entry-capture';
import {marketPersistenceDiagnostics} from '../lib/market/persistence-diagnostics';
import type {MarketSnapshot} from '../lib/market/types';

function fixture(){
 const capture=captureProposedEntry('TEST','2026-11-06T21:00:00Z',[{id:'entry',symbol:'TEST',source_id:'Alpaca:iex',received_at:'2026-11-06T20:59:00Z',metadata:{quoteTimestamp:'2026-11-06T20:59:00Z',bid:99,ask:101}}]);
 return {timing:{asOf:'2026-11-06T22:00:00Z',retrievalComplete:true,
  forecasts:[{id:'f',symbol:'TEST',created_at:'2026-11-06T21:00:00Z',horizonMs:1800000,source_snapshot:{proposedQuoteEntry:capture}}],
  observations:[{id:'other',symbol:'TEST',sourceId:'Alpaca:delayed_sip',quoteAt:'2026-11-06T21:30:01Z',receivedAt:'2026-11-06T21:35:00Z'}]},
  collection:{from:'2026-11-06T21:30:00Z',through:'2026-11-06T21:45:00Z',retrievalComplete:true,
   runs:[{id:'r',startedAt:'2026-11-06T21:35:00Z',finishedAt:'2026-11-06T21:35:01Z',recordedAt:'2026-11-06T21:35:02Z',symbols:['TEST'],saved:1,errors:[],attempts:[{source:'Alpaca',count:1,error:undefined as string|undefined}]}]}};
}
function report(x=fixture()){
 const r=collectionTraceDiagnostics(x);assert.equal(r.status,'DIAGNOSTIC_ONLY');if(r.status!=='DIAGNOSTIC_ONLY')throw Error('bad fixture');return r;
}
test('completed polls and another feed do not fill a missing frozen-source endpoint',()=>{
 const r=report(),f=r.forecasts[0];assert.equal(r.timingSummary.noCapturedEndpoint,1);
 assert.equal(f.completedRunsStartedInWindow,1);assert.equal(f.matchingStoredReceipts,0);
 assert.equal(f.otherFeedOnTimeQuoteReceipts,1);assert.deepEqual(f.otherStoredFeeds,['Alpaca:delayed_sip']);
 assert.equal(f.maxStartGapIncludingWindowEdgesNanoseconds,'600000000000');
 assert.equal(r.activated,false);assert.equal(r.scientificallyCertified,false);
});
test('missing polls are distinct from stale receipts and errors are reported without asserting cause',()=>{
 const x=fixture();x.collection.runs=[];x.timing.observations[0].sourceId='Alpaca:iex';x.timing.observations[0].quoteAt='2026-11-06T21:00:00Z';
 let f=report(x).forecasts[0];assert.equal(f.completedRunsStartedInWindow,0);assert.equal(f.matchingStoredReceipts,1);assert.equal(f.otherFeedStoredReceipts,0);
 x.collection.runs=fixture().collection.runs;x.collection.runs[0].attempts[0].error='HTTP 429';
 f=report(x).forecasts[0];assert.equal(f.runsWithRecordedErrors,1);assert.equal(f.alpacaResponseRuns,0);
});
test('collection completeness and exact nanosecond window coverage fail closed',()=>{
 const x=fixture();x.collection.retrievalComplete=false;assert.equal(report(x).forecasts[0].status,'NOT_ASSESSED');
 x.collection.retrievalComplete=true;x.collection.from='2026-11-06T21:30:00.000000001Z';assert.equal(report(x).forecasts[0].status,'NOT_ASSESSED');
 x.collection.from=fixture().collection.from;x.collection.through='2026-11-06T21:44:59.999999999Z';assert.equal(report(x).forecasts[0].status,'NOT_ASSESSED');
 x.timing.retrievalComplete=false;assert.deepEqual(report(x).forecasts,[]);
});
test('run starts use exact inclusive boundaries and symbol attribution',()=>{
 const x=fixture(),r=x.collection.runs[0];r.startedAt='2026-11-06T21:30:00Z';assert.equal(report(x).forecasts[0].completedRunsStartedInWindow,1);
 r.startedAt='2026-11-06T21:29:59.999999999Z';assert.equal(report(x).forecasts[0].completedRunsStartedInWindow,0);
 r.startedAt='2026-11-06T21:45:00Z';r.finishedAt=r.startedAt;r.recordedAt=r.startedAt;assert.equal(report(x).forecasts[0].completedRunsStartedInWindow,1);
 r.startedAt='2026-11-06T21:45:00.000000001Z';r.finishedAt=r.startedAt;r.recordedAt=r.startedAt;assert.equal(report(x).forecasts[0].completedRunsStartedInWindow,0);
 r.symbols=['OTHER'];assert.equal(report(x).forecasts[0].completedRunsStartedInWindow,0);
});
test('conflicting, malformed or future audits cannot manufacture a clean collection trace',()=>{
 const x=fixture();x.collection.runs.push({...x.collection.runs[0]});assert.equal(report(x).forecasts[0].completedRunsStartedInWindow,1);
 x.collection.runs[1].saved=2;assert.equal(collectionTraceDiagnostics(x).status,'UNVERIFIED');
 const y=fixture();y.collection.runs[0].recordedAt='2026-11-06T22:00:00.000000001Z';assert.equal(collectionTraceDiagnostics(y).status,'UNVERIFIED');
 for(const value of [null,{}, {timing:fixture().timing,collection:{...fixture().collection,runs:[null]}}, {timing:fixture().timing,collection:{...fixture().collection,runs:[{...fixture().collection.runs[0],attempts:[null]}]}}])assert.equal(collectionTraceDiagnostics(value).status,'UNVERIFIED');
});
test('selected-snapshot accounting preserves independent quote times and actual insert disposition',()=>{
 const snapshots=[{symbol:'A',source:'Alpaca:iex',timestamp:'2026-11-06T21:30:00Z',quoteTimestamp:'2026-11-06T21:00:00Z'},
  {symbol:'B',source:'Alpaca:delayed_sip',timestamp:'2026-11-06T21:15:00Z'},
  {symbol:'C',source:'Alpaca:iex',timestamp:'2026-11-06T21:30:00Z'}] as MarketSnapshot[];
 const before=JSON.stringify(snapshots);
 const r=marketPersistenceDiagnostics(['A','B','C','D'],snapshots,[{symbol:'A',source:'Alpaca:iex',saved:false},{symbol:'B',source:'Alpaca:delayed_sip',saved:true}]);
 assert.deepEqual(r.selected.map(s=>s.persistence),['CONFLICT_NO_INSERT','INSERTED','NOT_COMPLETED']);
 assert.equal(r.selected[0].quoteAt,'2026-11-06T21:00:00Z');assert.equal(r.selected[1].quoteAt,null);
 assert.deepEqual(r.unselectedSymbols,['D']);assert.equal(JSON.stringify(snapshots),before);
});
