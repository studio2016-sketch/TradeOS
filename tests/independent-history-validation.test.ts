import test from 'node:test';
import assert from 'node:assert/strict';
import {alpacaDailyHistory} from '../lib/research/market-factor-history';
import {massiveDailyHistory} from '../lib/research/massive-daily-history';
import {compareIndependentHistories} from '../lib/research/independent-history-comparison';
import {validateDailyHistory} from '../lib/research/daily-history-validation';
const at='2030-03-01T15:00:00Z',time='2030-02-01T05:00:00Z';
const bar={timestamp:time,open:100,high:102,low:99,close:101,volume:1000};
const wire=(provider:string)=>({t:provider==='Alpaca'?time:Date.parse(time),o:100,h:102,l:99,c:101,v:1000});
async function fetchFixture(provider:string,body:unknown,throws=false){
 const keys=['ALPACA_API_KEY','ALPACA_API_SECRET','MASSIVE_API_KEY'] as const;
 const old=keys.map(k=>process.env[k]),saved=globalThis.fetch;
 keys.forEach(k=>process.env[k]='test-private-key');
 globalThis.fetch=async()=>{if(throws)throw Error('test-private-key');return new Response(JSON.stringify(body),{status:200});};
 try{return await (provider==='Alpaca'?alpacaDailyHistory:massiveDailyHistory)('TEST',at);}
 finally{globalThis.fetch=saved;keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
}
test('both adapters accept complete valid raw OHLCV and preserve source identity',async()=>{
 for(const provider of ['Alpaca','Massive']){const r=await fetchFixture(provider,{[provider==='Alpaca'?'bars':'results']:[wire(provider)]});assert.equal(r.error,undefined);assert.deepEqual(r.bars,[{...bar,timestamp:provider==='Alpaca'?time:new Date(time).toISOString()}]);}
});
test('malformed rows are rejected before filtering, never sanitized into a valid history',async()=>{
 for(const provider of ['Alpaca','Massive'])for(const patch of [{c:null},{c:'101'},{v:-1},{h:98},{t:null},{t:provider==='Alpaca'?'2030-02-30T05:00:00Z':'bad'}]){
  const r=await fetchFixture(provider,{[provider==='Alpaca'?'bars':'results']:[wire(provider),{...wire(provider),...patch}]});assert.equal(r.error,'invalid_history');assert.deepEqual(r.bars,[]);
 }
});
test('duplicate daily dates cannot overwrite or inflate independent agreement',async()=>{
 for(const provider of ['Alpaca','Massive']){const r=await fetchFixture(provider,{[provider==='Alpaca'?'bars':'results']:[wire(provider),wire(provider)]});assert.equal(r.error,'invalid_history');}
 const valid=Array.from({length:21},(_,i)=>({...bar,timestamp:new Date(Date.UTC(2030,0,i+1,5)).toISOString()}));
 const r=compareIndependentHistories('TEST',at,{bars:valid,source:'Alpaca:iex'},{bars:[...valid,valid[0]],source:'Massive'});assert.equal(r.overlap,0);assert.equal(r.comparabilityEstablished,false);
});
test('pagination, missing arrays and contradictory symbol envelopes are unavailable',async()=>{
 for(const provider of ['Alpaca','Massive']){
  const key=provider==='Alpaca'?'bars':'results',page=provider==='Alpaca'?'next_page_token':'next_url',identity=provider==='Alpaca'?'symbol':'ticker';
  for(const body of [null,{}, {[key]:[] ,[page]:false},{[key]:[wire(provider)],[identity]:'OTHER'}])assert.equal((await fetchFixture(provider,body)).error,'invalid_response');
  assert.equal((await fetchFixture(provider,{[key]:[wire(provider)],[page]:'next'})).error,'pagination_incomplete');
 }
});
test('transport exceptions cannot leak provider credentials in errors',async()=>{
 for(const p of ['Alpaca','Massive'])assert.equal((await fetchFixture(p,{},true)).error,'fetch_failed');
});
test('error-bearing sources never yield comparable prices even when bars are present',()=>{
 const rows=Array.from({length:21},(_,i)=>({...bar,timestamp:new Date(Date.UTC(2030,0,i+1,5)).toISOString()}));
 const r=compareIndependentHistories('TEST',at,{bars:rows,source:'Alpaca',error:'pagination_incomplete'},{bars:rows,source:'Massive'});assert.equal(r.overlap,0);assert.equal(r.comparabilityEstablished,false);
 assert.equal(compareIndependentHistories('TEST',at,{bars:rows,source:'Alpaca'},{bars:rows.reverse(),source:'Massive'}).comparabilityEstablished,true);
});
test('invalid geometry and duplicate equivalent timezone dates fail validation',()=>{
 assert.equal(validateDailyHistory([bar,{...bar,timestamp:'2030-02-01T00:00:00-05:00'}]),false);
 for(const p of [{open:103},{close:98},{low:0},{high:Infinity}])assert.equal(validateDailyHistory([{...bar,...p}]),false);
});
test('current-day and future rows are excluded only after complete validation',async()=>{
 for(const provider of ['Alpaca','Massive']){
  const key=provider==='Alpaca'?'bars':'results';
  const current={...wire(provider),t:provider==='Alpaca'?'2030-03-01T05:00:00Z':Date.parse('2030-03-01T05:00:00Z')};
  assert.equal((await fetchFixture(provider,{[key]:[wire(provider),current]})).bars.length,1);
  const invalid={...current,h:0};assert.equal((await fetchFixture(provider,{[key]:[wire(provider),invalid]})).error,'invalid_history');
 }
});
