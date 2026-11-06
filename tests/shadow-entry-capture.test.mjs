import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT} from '../lib/research/prediction-outcome-verdict.ts';
const hooks=registerHooks({resolve(s,c,next){return s==='../db'?next(new URL('./fixtures/entry-capture-db.mjs',import.meta.url).href,c):next(s,c);}});
const {generateShadowForecasts}=await import('../lib/market/shadow.ts');hooks.deregister();

async function scenario(mode='valid',delay=0){
 const now=Date.now(),iso=ms=>new Date(ms).toISOString(),calls=[];let forecast=0,immutable=0;
 const quote={id:'900',symbol:'TEST',source_id:'Alpaca:iex',received_at:iso(now-1000),metadata:{quoteTimestamp:iso(now-2000),bid:99,ask:101}};
 globalThis.__entryCaptureSql=async(strings,...values)=>{
  const query=strings.join('?');calls.push({query,values});
  if(query.includes('select id::text')){if(mode==='error')throw Error('db failed');if(mode==='overflow')return Array.from({length:1001},()=>quote);return[quote];}
  if(query.includes("interval '75 minutes'"))return Array.from({length:6},(_,i)=>({id:i+1,event_time:iso(now-(6-i)*60000),received_at:iso(now-(6-i)*60000+100),source_id:'Alpaca:iex',payload_hash:'synthetic',metadata:{price:100+i,quoteTimestamp:iso(now-(6-i)*60000),bid:104,ask:106},freshness_score:1,quality_score:1}));
  if(query.includes('insert into forecast_ledger'))return[{id:++forecast,created_at:iso(now+delay)}];
  if(query.includes('insert into immutable_decision_records'))return[{id:++immutable,recorded_at:iso(now+delay)}];
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
