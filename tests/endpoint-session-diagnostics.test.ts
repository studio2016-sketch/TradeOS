import test from 'node:test';
import assert from 'node:assert/strict';
import {iexRegularWindow} from '../lib/research/iex-regular-window';
import {evidenceTimestamp} from '../lib/research/evidence-time';
import {captureProposedEntry} from '../lib/research/proposed-entry-capture';
import {receiptDelayDiagnostics} from '../lib/research/receipt-delay-diagnostics';
const session=(a:string,b:string)=>iexRegularWindow(evidenceTimestamp(a)!,evidenceTimestamp(b)!);
test('regular windows respect New York daylight saving rather than fixed UTC hours',()=>{
 for(const [date,open] of [['2026-07-01','13:30'],['2026-11-06','14:30']]){
  const r=session(date+'T'+open+':00Z',date+'T15:00:00Z');assert.equal(r.opportunity,'FULL');assert.equal('regularOpen' in r&&r.regularOpen,date+'T'+open+':00.000Z');
 }
});
test('holidays weekends and early close retain distinct regular-session context',()=>{
 assert.equal(session('2026-11-26T15:00:00Z','2026-11-26T15:15:00Z').opportunity,'NONE');
 assert.equal(session('2026-11-07T15:00:00Z','2026-11-07T15:15:00Z').opportunity,'NONE');
 const r=session('2026-11-27T17:55:00Z','2026-11-27T18:10:00Z');assert.equal(r.opportunity,'PARTIAL');assert.equal('regularClose' in r&&r.regularClose,'2026-11-27T18:00:00.000Z');
});
test('nanosecond close boundary and post-regular windows do not invent extra regular time',()=>{
 assert.equal(session('2026-11-06T21:00:00Z','2026-11-06T21:15:00Z').opportunity,'BOUNDARY_ONLY');
 assert.equal(session('2026-11-06T21:00:00.000000001Z','2026-11-06T21:15:00Z').opportunity,'NONE');
 assert.equal(session('2026-11-06T20:55:00Z','2026-11-06T21:10:00Z').opportunity,'PARTIAL');
});
test('unpinned years and cross-local-day windows remain unknown',()=>{
 assert.equal(session('2027-01-04T15:00:00Z','2027-01-04T15:15:00Z').opportunity,'UNKNOWN');
 assert.equal(session('2026-11-06T23:00:00Z','2026-11-07T08:00:00Z').opportunity,'UNKNOWN');
});
function fixture(){
 const entry={id:'entry',symbol:'TEST',source_id:'Alpaca:iex',received_at:'2026-11-06T20:59:00Z',metadata:{quoteTimestamp:'2026-11-06T20:59:00Z',bid:99,ask:101}};
 const capture=captureProposedEntry('TEST','2026-11-06T21:00:00Z',[entry]);
 return {asOf:'2026-11-06T22:00:00Z',retrievalComplete:true,forecasts:[{id:'f',symbol:'TEST',created_at:'2026-11-06T21:00:00Z',horizonMs:1800000,source_snapshot:{proposedQuoteEntry:capture}}],observations:[{id:'stale',symbol:'TEST',sourceId:'Alpaca:iex',quoteAt:'2026-11-06T21:00:01Z',receivedAt:'2026-11-06T21:35:00Z'}]};
}
test('missing endpoint with pre-horizon receipts differs from absent window receipts',()=>{
 const x=fixture(),r=receiptDelayDiagnostics(x);assert.equal(r.status,'DIAGNOSTIC_ONLY');if(r.status!=='DIAGNOSTIC_ONLY')return;
 assert.equal(r.summary.missingWithPreHorizonReceipts,1);assert.equal(r.summary.missingOutsideRegularSession,1);assert.equal(r.forecasts[0].missingReceiptContext,'PRE_HORIZON_QUOTES_ONLY');
 x.observations=[];const absent=receiptDelayDiagnostics(x);assert.equal(absent.status==='DIAGNOSTIC_ONLY'&&absent.summary.missingWithoutWindowReceipts,1);
});
test('incomplete or pending retrieval cannot diagnose missing receipt context',()=>{
 const x=fixture();x.retrievalComplete=false;let r=receiptDelayDiagnostics(x);assert.equal(r.status==='DIAGNOSTIC_ONLY'&&r.forecasts[0].missingReceiptContext,'NOT_ASSESSED');
 x.retrievalComplete=true;x.asOf='2026-11-06T21:40:00Z';r=receiptDelayDiagnostics(x);assert.equal(r.status==='DIAGNOSTIC_ONLY'&&r.forecasts[0].missingReceiptContext,'NOT_ASSESSED');
});
