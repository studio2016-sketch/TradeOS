import test from 'node:test';
import assert from 'node:assert/strict';
import {captureProposedEntry} from '../lib/research/proposed-entry-capture';
import {loadQuoteOutcomeV4,replayQuoteOutcomeV4,type EvidenceRow} from '../lib/research/quote-resolver-v4';
const at=(m:number)=>new Date(Date.UTC(2030,0,2,14)+m*60000).toISOString();
const row=(id='entry',m=-1,bid=99):EvidenceRow=>({id,symbol:'TEST',source_id:'Alpaca:iex',received_at:at(m),metadata:{quoteTimestamp:at(m),bid,ask:bid+2},payload_hash:'fixture-hash-'+id});
function fixture(){const e=row();return {e,f:{id:'forecast',created_at:at(0),symbol:'TEST',horizonMs:1800000,source_snapshot:{proposedQuoteEntry:captureProposedEntry('TEST',at(0),[e])}}};}
function run(endpoints=[row('end',30,109)],complete=true){const {e,f}=fixture();return replayQuoteOutcomeV4(f,at(46),[e],endpoints,complete);}
test('capture -> persisted JSON -> entry readback -> endpoint replay is reproducible and never certified',async()=>{
 const {e,f}=fixture();const stored=JSON.parse(JSON.stringify(f));let query='';
 const result=await loadQuoteOutcomeV4(async(s:TemplateStringsArray)=>{query=s.join('?');return [{...e,kind:'entry'},{...row('end',30,109),kind:'endpoint'}];},stored,at(46));
 assert.equal(result.status,'REPRODUCIBLE_PROPOSAL');assert.equal(result.scientificallyEligible,false);assert.equal(result.activated,false);
 if('realizedReturn' in result)assert.equal(result.realizedReturn,.1);
 assert.match(query,/limit 10001/);assert.doesNotMatch(query,/insert|update|delete/i);
 assert.deepEqual(result,run());
});
test('missing, crossed and conflicting quotes fail closed',()=>{
 assert.equal(run([]).status,'VOID');
 assert.equal(run([{...row('end',30),metadata:{quoteTimestamp:at(30),bid:101,ask:100}}]).status,'UNVERIFIED');
 assert.equal(run([row('a',30),row('b',30,98)]).status,'UNVERIFIED');
});
test('incomplete retrieval and overflow cannot produce terminal outcomes',()=>{
 assert.equal(run([],false).status,'UNVERIFIED');assert.equal(run(Array.from({length:10001},()=>row('e',30))).status,'UNVERIFIED');
});
test('late receipt excluded and grace must close before selecting earliest captured endpoint',()=>{
 assert.equal(run([{...row('late',30),received_at:at(46)}]).status,'VOID');
 const {e,f}=fixture();assert.equal(replayQuoteOutcomeV4(f,at(45),[e],[row('end',30)],true).status,'PENDING');
 assert.deepEqual(run([row('b',31),row('a',30)]),run([row('a',30),row('b',31)]));
});
test('source mismatch, missing provenance and entry mutation rejected',()=>{
 assert.equal(run([{...row('e',30),source_id:'Alpaca:sip'}]).status,'UNVERIFIED');
 assert.equal(run([{...row('e',30),payload_hash:''}]).status,'UNVERIFIED');
 const {e,f}=fixture();assert.equal(replayQuoteOutcomeV4(f,at(46),[{...e,id:'other'}],[],true).status,'UNVERIFIED');
});
test('historical records and incompatible capture versions remain unverified',()=>{
 const {e,f}=fixture();assert.equal(replayQuoteOutcomeV4({...f,source_snapshot:{}},at(46),[e],[],true).status,'UNVERIFIED');
 f.source_snapshot.proposedQuoteEntry.policyFingerprint='other' as any;assert.equal(replayQuoteOutcomeV4(f,at(46),[e],[],true).status,'UNVERIFIED');
});
test('delayed entry receipts, capture after creation, impossible dates and submillisecond ambiguity rejected',()=>{
 const {e,f}=fixture();
 for(const stamp of [at(-2),'2030-02-30T14:00:00Z','2030-01-02T14:00:00.000001Z'])assert.equal(replayQuoteOutcomeV4({...f,created_at:stamp},at(46),[e],[],true).status,'UNVERIFIED');
 assert.equal(run([{...row('e',30),received_at:'2030-01-02T14:30:00.000001Z'}]).status,'UNVERIFIED');
});
test('database failure redacted and incomplete sentinel retained before deduplication',async()=>{
 const {f}=fixture();const r=await loadQuoteOutcomeV4(async()=>{throw Error('private connection');},f,at(46));assert.equal(r.status,'UNVERIFIED');assert.doesNotMatch(JSON.stringify(r),/private/);
});
test('submillisecond chronology accepted away from boundaries and rejected for lossy sorting ties',()=>{
 const {e,f}=fixture();
 f.created_at='2030-01-02T14:00:00.001123Z';
 assert.equal(replayQuoteOutcomeV4(f,at(46),[e],[row('e',31)],true).status,'REPRODUCIBLE_PROPOSAL');
 const a={...row('a',31),metadata:{...row('a',31).metadata,quoteTimestamp:'2030-01-02T14:31:00.000001Z'},received_at:at(32)};
 const b={...a,id:'b',metadata:{...a.metadata,quoteTimestamp:'2030-01-02T14:31:00.000002Z'}};
 assert.equal(replayQuoteOutcomeV4(f,at(46),[e],[a,b],true).status,'UNVERIFIED');
});
test('provenance conflict rejected and evidence digest survives JSON key order',()=>{
 assert.equal(run([row('e',30),{...row('e',30),payload_hash:'different'}]).status,'UNVERIFIED');
 const {e,f}=fixture(),reorder=(x:any):any=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).reverse().map(([k,v])=>[k,reorder(v)])):x;
 assert.deepEqual(replayQuoteOutcomeV4(reorder(f),at(46),[reorder(e)],[reorder(row('end',30,109))],true),run());
});
