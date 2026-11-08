import test from 'node:test';
import assert from 'node:assert/strict';
import {captureProposedEntry} from '../lib/research/proposed-entry-capture';
import {receiptDelayDiagnostics as check} from '../lib/research/receipt-delay-diagnostics';
const at=(minute:number)=>new Date(Date.UTC(2030,0,2,14)+minute*60000).toISOString();
const quote=(id:string,m:number,receipt=m)=>({id,symbol:'TEST',sourceId:'Alpaca:iex',quoteAt:at(m),receivedAt:at(receipt)});
function fixture(){
 const e=quote('entry',-1);
 const capture=captureProposedEntry('TEST',at(0),[{id:e.id,symbol:e.symbol,source_id:e.sourceId,received_at:e.receivedAt,metadata:{quoteTimestamp:e.quoteAt,bid:99,ask:101}}]);
 return {asOf:at(60),retrievalComplete:true,forecasts:[{id:'f',symbol:'TEST',created_at:at(0),horizonMs:1800000,source_snapshot:{proposedQuoteEntry:capture}}],observations:[quote('on',30,31)]};
}
const status=(x:ReturnType<typeof fixture>)=>{const r=check(x);assert.equal(r.status,'DIAGNOSTIC_ONLY');return r.status==='DIAGNOSTIC_ONLY'?r:null!;};
test('late-only, absent and on-time timing are distinct, with no activation or certification',()=>{
 const x=fixture();assert.equal(status(x).summary.onTimeTiming,1);
 x.observations=[quote('late',30,46)];assert.equal(status(x).summary.lateOnly,1);
 x.observations=[];assert.equal(status(x).summary.noCapturedEndpoint,1);
 assert.equal(status(x).scientificallyCertified,false);assert.equal(status(x).activated,false);
});
test('receipt deadline is inclusive at nanosecond precision and receipt grace must close',()=>{
 const x=fixture();x.observations=[{...quote('exact',30),receivedAt:'2030-01-02T14:45:00.000000001Z'}];assert.equal(status(x).summary.lateOnly,1);
 x.observations=[quote('exact',30,45)];assert.equal(status(x).summary.onTimeTiming,1);
 x.asOf=at(45);assert.equal(status(x).summary.pending,1);assert.equal(status(x).summary.assessed,0);
});
test('incomplete retrieval never creates a missing-endpoint rate',()=>{
 const x=fixture();x.retrievalComplete=false;x.observations=[];
 const r=status(x);assert.equal(r.summary.incomplete,1);assert.equal(r.summary.noCapturedEndpoint,0);assert.equal(r.summary.onTimeTimingRate,null);
});
test('wrong feed, symbol, pre-horizon and post-window quotes cannot supply timing coverage',()=>{
 const x=fixture();x.observations=[{...quote('sip',30),sourceId:'Alpaca:sip'},{...quote('other',30),symbol:'OTHER'},quote('early',29),quote('after',46)];
 assert.equal(status(x).summary.noCapturedEndpoint,1);
});
test('delays use unique observation IDs even when two forecasts share a window',()=>{
 const x=fixture();x.forecasts.push({...x.forecasts[0],id:'g'});x.observations.push({...x.observations[0]});
 const r=status(x);assert.equal(r.summary.onTimeTiming,2);assert.equal(r.receiptDelays[0].sampleCount,1);assert.equal(r.receiptDelays[0].p50,'60000000000');
});
test('future receipts excluded and conflicts, invalid dates and reversed chronology fail closed',()=>{
 const x=fixture();x.observations=[quote('future',30,61)];assert.equal(status(x).summary.noCapturedEndpoint,1);
 x.observations=[quote('same',30),quote('same',31)];assert.equal(check(x).status,'UNVERIFIED');
 x.observations=[quote('reverse',31,30)];assert.equal(check(x).status,'UNVERIFIED');
 x.asOf='2030-02-30T14:00:00Z';assert.equal(check(x).status,'UNVERIFIED');
});
test('unsupported capture and duplicate forecast IDs cannot inflate assessed counts',()=>{
 const x=fixture();(x.forecasts[0].source_snapshot.proposedQuoteEntry as any).policyFingerprint='other';assert.equal(status(x).summary.unverified,1);
 x.forecasts.push({...x.forecasts[0]});assert.equal(check(x).status,'UNVERIFIED');
});
test('diagnostics are independent of prices and returns and do not mutate input',()=>{
 const x=fixture(),before=JSON.stringify(x);const a=status(x);assert.equal(JSON.stringify(x),before);
 const extra=JSON.parse(before);extra.forecasts[0].realized_return=100;extra.observations[0].price=-99;
 assert.deepEqual(check(extra),a);
});
test('nearest-rank quantiles retain long late-receipt tails without double counting',()=>{
 const x=fixture();x.observations=[quote('a',30,31),quote('b',31,31),quote('c',32,50)];
 const r=status(x);assert.equal(r.forecasts[0].lateCapturedQuotes,1);assert.equal(r.summary.onTimeTiming,1);
 assert.equal(r.receiptDelays[0].sampleCount,3);assert.equal(r.receiptDelays[0].p50,'60000000000');assert.equal(r.receiptDelays[0].p95,'1080000000000');
 assert.equal(check({...x,retrievalComplete:'true'}).status,'UNVERIFIED');
});
