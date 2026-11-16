import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT} from '../lib/research/prediction-outcome-verdict.ts';
const hooks=registerHooks({resolve(s,c,next){return s==='../db'?next(new URL('./fixtures/entry-capture-db.mjs',import.meta.url).href,c):next(s,c);}});
const {generateShadowForecasts}=await import('../lib/market/shadow.ts');hooks.deregister();

async function scenario(mode='valid',delay=0,clocks={}){
 const now=Date.now(),iso=ms=>new Date(ms).toISOString(),calls=[];let forecast=0,immutable=0;
 const quote={id:'900',symbol:'TEST',source_id:'Alpaca:iex',received_at:iso(now-1000),metadata:{quoteTimestamp:iso(now-2000),bid:99,ask:101}};
 globalThis.__entryCaptureSql=async(strings,...values)=>{
  const query=strings.join('?');calls.push({query,values});
  if(query.includes('select id::text')){if(mode==='error')throw Error('db failed');if(mode==='overflow')return Array.from({length:1001},()=>quote);return[quote];}
  if(query.includes("interval '75 minutes'"))return Array.from({length:6},(_,i)=>({id:i+1,event_time:i===5&&clocks.event!==undefined?clocks.event:iso(now-(6-i)*60000),received_at:i===5&&clocks.receipt!==undefined?clocks.receipt:iso(now-(6-i)*60000+100),source_id:'Alpaca:iex',payload_hash:'synthetic',metadata:{price:100+i,quoteTimestamp:iso(now-(6-i)*60000),bid:104,ask:106},freshness_score:1,quality_score:1}));
  if(query.includes('insert into forecast_ledger')){forecast++;return[{id:forecast,created_at:clocks[forecast===1?'baseline':'challenger']??iso(now+delay)}];}
  if(query.includes('insert into immutable_decision_records'))return[{id:++immutable,recorded_at:clocks.recorded??iso(now+delay)}];
  return[];
 };
 try{await generateShadowForecasts(['TEST']);return{calls,forecasts:calls.filter(x=>x.query.includes('insert into forecast_ledger')),immutables:calls.filter(x=>x.query.includes('insert into immutable_decision_records'))};}
 finally{delete globalThis.__entryCaptureSql;}
}
const objects=call=>call.values.flatMap(v=>{if(typeof v!=='string'||!v.startsWith('{'))return[];try{return[JSON.parse(v)];}catch{return[];}});
test('actual shadow generator stores identical inactive capture in both snapshots and hashed immutable features',async()=>{
 const r=await scenario();assert.equal(r.forecasts.length,2);assert.equal(r.immutables.length,2);
 const snaps=r.forecasts.map(x=>objects(x).find(x=>x.outcomeProtocol));assert.deepEqual(snaps[0].proposedQuoteEntry,snaps[1].proposedQuoteEntry);
 for(const snap of snaps){assert.equal(snap.outcomeProtocol.protocolFingerprint,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT);assert.equal(snap.proposedQuoteEntry.activated,false);assert.equal(snap.proposedQuoteEntry.validatedForForecast,false);}
 for(const call of r.immutables){const features=objects(call).find(x=>x.proposedQuoteEntry);assert.deepEqual(features.proposedQuoteEntry,snaps[0].proposedQuoteEntry);assert.ok(call.values.includes(createHash('sha256').update(JSON.stringify(features)).digest('hex')));}
 assert.equal(r.calls.filter(x=>x.query.includes('select id::text')).length,1);assert.ok(r.calls.every(x=>!/^\s*(update|delete)/i.test(x.query)));
});
test('read errors and truncated capture do not suppress existing forecast generation or active bindings',async()=>{
 for(const mode of ['error','overflow']){const r=await scenario(mode);assert.equal(r.forecasts.length,2);for(const call of r.forecasts){const s=objects(call).find(x=>x.outcomeProtocol);assert.equal(s.proposedQuoteEntry.status,'UNAVAILABLE');assert.equal(s.proposedQuoteEntry.entry,null);assert.equal(s.outcomeProtocol.protocolFingerprint,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT);}}
});
test('delayed actual forecast creation never turns capture-only evidence into a valid forecast binding',async()=>{
 const r=await scenario('valid',10*60_000);for(const call of r.forecasts){const s=objects(call).find(x=>x.outcomeProtocol);assert.equal(s.proposedQuoteEntry.reason,'ENTRY_VALID_AT_CAPTURE_ONLY');assert.equal(s.proposedQuoteEntry.validatedForForecast,false);}
});

const verifications=r=>r.calls.filter(c=>c.query.includes('insert into tradeos_decision_source_verifications'));
const boundary='2026-10-18 14:00:00.000500+00';
const exactClocks={event:'2026-10-18 14:00:00.000100+00',receipt:'2026-10-18 14:00:00.000400+00',baseline:boundary,challenger:'2026-10-18 14:00:00.000600+00',recorded:'2026-10-18 14:05:00+00'};
test('both verifications preserve exact source clocks and each actual forecast creation, regardless of delayed immutable insertion',async()=>{
 const r=await scenario('valid',0,exactClocks),v=verifications(r);
 assert.equal(v.length,2);
 assert.deepEqual(v.map(c=>c.values.slice(2,5)),[
  [exactClocks.event,exactClocks.receipt,exactClocks.baseline],
  [exactClocks.event,exactClocks.receipt,exactClocks.challenger]
 ]);
 assert.ok(r.forecasts.every(c=>c.query.includes('created_at::text as created_at')));
 const read=r.calls.find(c=>c.query.includes("interval '75 minutes'"));
 assert.match(read.query,/event_time::text as event_time,received_at::text as received_at/);
 assert.ok(v.every(c=>!c.values.includes(exactClocks.recorded)));
});
test('receipt after actual challenger creation cannot borrow the later immutable timestamp',async()=>{
 const r=await scenario('valid',0,{...exactClocks,baseline:'2026-10-18 14:00:00.000200+00',challenger:'2026-10-18 14:00:00.000300+00'});
 assert.equal(r.forecasts.length,2);assert.equal(r.immutables.length,2);
 assert.equal(verifications(r).length,0);
});
test('nanosecond lookahead and event-after-receipt fail closed; equal boundary and equivalent offsets pass',async()=>{
 for(const clocks of [
  {...exactClocks,receipt:'2026-10-18 14:00:00.000600001+00'},
  {...exactClocks,event:'2026-10-18 14:00:00.000400001+00'},
  {...exactClocks,receipt:'invalid'},
  {...exactClocks,baseline:'invalid',challenger:'2026-02-30T14:00:00Z'},
 ])assert.equal(verifications(await scenario('valid',0,clocks)).length,0);
 const equal={...exactClocks,event:'2026-10-18T10:00:00.000500-04:00',receipt:boundary,challenger:boundary};
 assert.equal(verifications(await scenario('valid',0,equal)).length,2);
});
test('each prediction uses its own clock and never substitutes baseline creation for challenger',async()=>{
 const r=await scenario('valid',0,{...exactClocks,baseline:'2026-10-18 14:00:00.000399+00'});
 const v=verifications(r);assert.equal(v.length,1);assert.equal(v[0].values[0],2);
 assert.equal(v[0].values[4],exactClocks.challenger);
});
test('supplemental entry selection precedes both forecasts and never queries future outcome availability',async()=>{
 const r=await scenario(),select=r.calls.findIndex(c=>c.query.includes('select id::text'));
 assert.ok(select>=0);assert.ok(r.calls.indexOf(r.forecasts[0])>select);
 assert.ok(r.calls.indexOf(r.forecasts[1])>select);
 assert.ok(r.calls.every(c=>!c.query.includes('forecast_outcomes')));
 const snapshots=r.forecasts.map(c=>objects(c).find(o=>o.outcomeProtocol));
 assert.deepEqual(snapshots[0].proposedQuoteEntry.entry,snapshots[1].proposedQuoteEntry.entry);
 assert.equal(snapshots[0].proposedQuoteEntry.entry.sourceId,'Alpaca:iex');
});
