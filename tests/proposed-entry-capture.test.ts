import test from 'node:test';
import assert from 'node:assert/strict';
import {captureProposedEntry as capture,loadProposedEntry} from '../lib/research/proposed-entry-capture.ts';
const at=(m:number)=>new Date(Date.UTC(2030,0,2,14,0)+m*60_000).toISOString();
const row=(id='1',m=-1)=>({id,symbol:'TEST',source_id:'Alpaca:iex',received_at:at(m),metadata:{quoteTimestamp:at(m),bid:99,ask:101}});
test('captures exact entry at cutoff with explicit inactive non-forecast-valid status',()=>{
 const r=capture('TEST',at(0),[row()]);assert.equal(r.status,'CAPTURED_PROPOSAL');assert.equal(r.entry?.id,'1');assert.equal(r.validatedForForecast,false);assert.equal(r.sourceTimeCertified,false);assert.equal(r.activated,false);
});
test('fixed IEX-only policy and deterministic latest quote/receipt/ID tie',()=>{
 const rows=[row('z'),row('a'),row('old',-2),{...row('sip',0),source_id:'Alpaca:sip'}];assert.equal(capture('TEST',at(0),rows).entry?.id,'a');assert.deepEqual(capture('TEST',at(0),rows),capture('TEST',at(0),rows.reverse()));
});
test('capture chronology and exact five-minute boundary',()=>{
 assert.equal(capture('TEST',at(0),[row('1',-5)]).status,'CAPTURED_PROPOSAL');assert.equal(capture('TEST',at(0),[row('1',-5.001)]).status,'UNAVAILABLE');
 const r=row();r.received_at=at(-2);assert.equal(capture('TEST',at(0),[r]).reason,'QUOTE_AFTER_RECEIPT');
});
test('future receipts cannot revise capture or invalidate it with malformed prices',()=>{
 const future={...row(),received_at:at(1),metadata:{quoteTimestamp:'invalid',bid:NaN,ask:0}};assert.deepEqual(capture('TEST',at(0),[row(),future]),capture('TEST',at(0),[row()]));
});
test('conflicting IDs or same quote timestamp fail closed',()=>{
 const r=row();assert.equal(capture('TEST',at(0),[r,{...r,metadata:{...r.metadata,ask:102}}]).status,'UNAVAILABLE');
 assert.equal(capture('TEST',at(0),[r,{...r,id:'2',metadata:{...r.metadata,bid:98}}]).reason,'CONFLICTING_QUOTE_TIMESTAMP');
});
test('invalid timestamps/prices do not masquerade as frozen quotes',()=>{
 for(const patch of [{quoteTimestamp:''},{bid:true},{bid:0},{ask:Infinity},{bid:102}]){const r=row();Object.assign(r.metadata,patch);assert.equal(capture('TEST',at(0),[r]).status,'UNAVAILABLE');}
});
test('bounded query sentinel fails closed regardless of duplicates or feed',()=>{assert.equal(capture('TEST',at(0),Array.from({length:1001},()=>row())).reason,'CANDIDATE_LIMIT_EXCEEDED');});
test('loader uses receipt window not trade time, bounded SELECT only, and catches errors',async()=>{
 let query='';const sql=async(strings:TemplateStringsArray,..._args:any[])=>{query=strings.join('?');return[row()];};
 assert.equal((await loadProposedEntry(sql,'TEST',at(0))).status,'CAPTURED_PROPOSAL');assert.match(query,/limit 1001/);assert.match(query,/received_at>=/);assert.doesNotMatch(query,/event_time|insert|update|delete/i);
 assert.equal((await loadProposedEntry(async()=>{throw Error('sensitive database detail');},'TEST',at(0))).reason,'CAPTURE_READ_FAILED');
});

test('preserves exact timestamp text while rejecting price ambiguity within one millisecond',()=>{
 const a=row();a.metadata.quoteTimestamp='2030-01-02T13:59:00.000123456Z';a.received_at='2030-01-02 13:59:01+00';
 assert.equal(capture('TEST',at(0),[a]).entry?.quoteAt,a.metadata.quoteTimestamp);assert.equal(capture('TEST',at(0),[a]).entry?.receivedAt,a.received_at);
 const b={...a,id:'2',metadata:{...a.metadata,quoteTimestamp:'2030-01-02T13:59:00.000234567Z',bid:98}};
 assert.equal(capture('TEST',at(0),[a,b]).reason,'CONFLICTING_QUOTE_TIMESTAMP');
});

test('impossible calendar dates and timezone-free times are not normalized into evidence',()=>{
 for(const stamp of ['2030-02-30T13:59:00Z','2030-01-02T24:00:00Z','2030-01-02T13:59:00']){const r=row();r.metadata.quoteTimestamp=stamp;assert.equal(capture('TEST',at(0),[r]).reason,'INVALID_QUOTE_TIME');}
});
