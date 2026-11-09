import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeProviderNews as decode,PROVIDER_NEWS_POLICY} from '../lib/market/provider-news-validation';
import {observedNewsFactorsWithDependencies} from '../lib/research/news-factor-evidence';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
const receipt='2030-03-02T12:00:00Z';
const alpaca=(extra:Record<string,unknown>={})=>({id:123,created_at:'2030-03-02T11:58:00Z',updated_at:'2030-03-02T11:59:00.123456Z',headline:'Company raises guidance',symbols:['TEST'],summary:'Synthetic',...extra});
const massive=(extra:Record<string,unknown>={})=>({id:'article',published_utc:'2030-03-02T11:59:00.123456Z',title:'Company raises guidance',tickers:['TEST'],description:'Synthetic',publisher:{name:'Fixture'},...extra});
test('provider clocks remain explicit: missing dates never become current-time observations',()=>{
 for(const [provider,payload] of [['alpaca',{news:[alpaca({created_at:undefined,updated_at:undefined})]}],['massive',{results:[massive({published_utc:undefined})]}]] as const){
  const r=decode(provider,payload,receipt);assert.equal(r.items.length,0);assert.equal(r.rejected[0].reason,'missing_source_timestamp');
 }
});
test('malformed, impossible and zoneless dates cannot be repaired by coercion or a fallback field',()=>{
 for(const time of ['2030-02-30T11:59:00Z','2030-03-02T11:59:00','2030-03-02','invalid',123,{}]){
  for(const [provider,payload] of [['alpaca',{news:[alpaca({updated_at:time})]}],['massive',{results:[massive({published_utc:time})]}]] as const){
   const r=decode(provider,payload,receipt);assert.equal(r.items.length,0);assert.equal(r.rejected[0].reason,'invalid_source_timestamp');
  }
 }
});
test('Alpaca creation/update chronology is exact and latest-version semantics are preserved',()=>{
 const valid=decode('alpaca',{news:[alpaca()]},receipt);assert.equal(valid.items[0].timestamp,alpaca().updated_at);assert.equal(valid.policyVersion,PROVIDER_NEWS_POLICY);
 const onlyCreated=decode('alpaca',{news:[alpaca({updated_at:undefined})]},receipt);assert.equal(onlyCreated.items[0].timestamp,alpaca().created_at);
 const reverse=decode('alpaca',{news:[alpaca({created_at:'2030-03-02T11:59:00.000002Z',updated_at:'2030-03-02T11:59:00.000001Z'})]},receipt);
 assert.equal(reverse.rejected[0].reason,'source_timestamp_reversal');
});
test('source times after receipt are rejected even inside one millisecond',()=>{
 assert.equal(decode('massive',{results:[massive({published_utc:receipt})]},receipt).items.length,1);
 assert.equal(decode('massive',{results:[massive({published_utc:'2030-03-02T12:00:00.000000001Z'})]},receipt).rejected[0].reason,'source_timestamp_after_receipt');
 assert.throws(()=>decode('massive',{results:[]},'2030-03-02'),/receipt clock/);
});
test('cache-unsafe precision and timezone offsets are rejected before source data can be rounded',()=>{
 assert.equal(decode('massive',{results:[massive({published_utc:'2030-03-02T11:59:00.000000001Z'})]},receipt).rejected[0].reason,'unsupported_storage_precision');
 assert.equal(decode('massive',{results:[massive({published_utc:'2030-03-02T11:59:00+16:00'})]},receipt).rejected[0].reason,'unsupported_storage_timezone_offset');
 assert.equal(decode('massive',{results:[massive({published_utc:'2030-03-02T11:59:00.123456000Z'})]},receipt).items[0].timestamp,'2030-03-02T11:59:00.123456000Z');
});
test('invalid envelopes remain failures while an explicit empty result remains a valid empty response',()=>{
 for(const payload of [null,[],{}, {results:{}},{status:'ERROR',results:[]},{error:'synthetic',results:[]}])assert.throws(()=>decode('massive',payload,receipt));
 const r=decode('massive',{results:[]},receipt);assert.equal(r.received,0);assert.deepEqual(r.items,[]);
});
test('invalid identity, content and symbol entries cannot silently become attributed news',()=>{
 for(const extra of [{id:undefined,article_url:undefined},{id:{}},{id:Number.MAX_SAFE_INTEGER+1},{title:{}},{tickers:['TEST',123]},{description:{}},{publisher:{name:{}}}])assert.equal(decode('massive',{results:[massive(extra)]},receipt).items.length,0);
 const urlFallback=decode('massive',{results:[massive({id:undefined,article_url:'https://example.invalid/article'})]},receipt);
 assert.equal(urlFallback.items[0].id,'massive:https://example.invalid/article');
});
test('a malformed sibling is isolated with exact counts and static rejection diagnostics',()=>{
 const r=decode('alpaca',{news:[alpaca(),null,alpaca({updated_at:'bad'})]},receipt);
 assert.equal(r.received,3);assert.equal(r.items.length,1);assert.deepEqual(r.rejected,[{index:1,reason:'invalid_article_shape'},{index:2,reason:'invalid_source_timestamp'}]);
});
test('actual decoder-to-watchlist-to-persistence path excludes undated source input',async()=>{
 const decoded=decode('alpaca',{news:[alpaca(),alpaca({id:456,created_at:undefined,updated_at:undefined})]},receipt);
 const result=await observedNewsFactorsWithDependencies(['TEST'],{news:async()=>({news:decoded.items,errors:[]}),reaction:async()=>null,clock:()=>new Date('2030-03-02T12:00:01Z')},new Date(receipt));
 assert.equal(result.candidates.find(e=>e.factor==='headline_count')?.value,1);
 const event=result.candidates.find(e=>e.factor==='guidance_change')!;assert.equal(event.observedAt,alpaca().updated_at);
 let calls=0;
 const persisted=await persistEvidenceWithSql(async()=>{calls++;return[{id:'synthetic'}];},result.candidates,new Date(result.retrievedAt));
 assert.equal(persisted.saved,result.candidates.length);assert.equal(calls,result.candidates.length);
});
