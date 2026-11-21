import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledDailyCollection} from '../lib/research/scheduled-daily-collection';
const request=(path='',method='GET')=>new Request('https://tradeos.invalid/api/cron/daily-factors'+path,{method});
const now=new Date('2026-11-20T22:15:00Z');
test('scheduled collector denies anonymous and parameterized calls before clock or collection',async()=>{
 const never=()=>assert.fail('no execution');
 assert.equal((await scheduledDailyCollection({authorize:()=>false,clock:never,execute:never})(request())).status,401);
 for(const req of [request('?symbol=SPY'),request('','POST')])assert.equal((await scheduledDailyCollection({authorize:()=>true,clock:never,execute:never})(req)).status,400);
});
test('scheduled collector skips weekends and exchange holidays without collection',async()=>{
 for(const instant of ['2026-11-21T22:15:00Z','2026-11-26T22:15:00Z']){
  const res=await scheduledDailyCollection({authorize:()=>true,clock:()=>new Date(instant),execute:async()=>assert.fail('closed session')})(request());
  assert.equal(res.status,200);assert.equal((await res.json()).status,'no_completed_session_today');
 }
});
test('scheduled collector fails closed before finalized sessions and outside the pinned calendar',async()=>{
 for(const instant of ['2026-11-20T20:59:00Z','2026-11-20T21:05:00Z','2027-01-04T22:15:00Z']){
  const res=await scheduledDailyCollection({authorize:()=>true,clock:()=>new Date(instant),execute:async()=>assert.fail('not ready')})(request());
  if(instant.includes('20:59'))assert.equal((await res.json()).status,'no_completed_session_today');
  else assert.equal(res.status,503);
 }
});
test('scheduled collection exposes only bounded receipt fields and never scientific or order authority',async()=>{
 const res=await scheduledDailyCollection({authorize:()=>true,clock:()=>now,execute:async clock=>{assert.equal(+clock(),+now);return {status:'observed_not_certified',saved:72,candidates:72,session:'2026-11-20',secret:'do not disclose'} as any;}})(request());
 assert.equal(res.status,200);assert.deepEqual(await res.json(),{status:'observed_not_certified',session:'2026-11-20',saved:72,candidates:72,certified:false,ordersAllowed:false,retryAllowed:false});
 assert.match(res.headers.get('cache-control')! ,/private, no-store/);
});
test('claim replay stays idempotent and failed or expired collections remain unconfirmed without retry',async()=>{
 const duplicate=await scheduledDailyCollection({authorize:()=>true,clock:()=>now,execute:async()=>({status:'already_attempted',saved:0})})(request());
 assert.equal((await duplicate.json()).status,'already_attempted');
 for(const execute of [async()=>{throw Error('private SQL');},async()=>({status:'observed_not_certified',saved:73})]){
  const res=await scheduledDailyCollection({authorize:()=>true,clock:()=>now,execute})(request());assert.equal(res.status,503);assert.equal((await res.json()).retryAllowed,false);
 }
 let calls=0;
 const res=await scheduledDailyCollection({authorize:()=>true,clock:()=>new Date(+now+(calls++?90001:0)),execute:async clock=>{clock();return {status:'observed_not_certified',saved:72};}})(request());
 assert.equal(res.status,503);
});
