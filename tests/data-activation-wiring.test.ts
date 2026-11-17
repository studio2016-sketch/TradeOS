import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {DATA_ACTIVATION_POLICY} from '../lib/research/data-activation-policy';
import {invokeApprovedDailyCollection} from '../lib/research/daily-invocation';
import {runIntradayIngestion,IntradayRunFailure} from '../lib/research/intraday-ingestion-runner';
import {assertDataStorageReady} from '../lib/research/data-storage-readiness';
const now=new Date('2026-11-16T22:00:00Z');
const approval={id:'fixture-one-session',session:'2026-11-16',opensAt:'2026-11-16T22:00:00Z',expiresAt:'2026-11-16T23:00:00Z'};
const request={approvalId:approval.id,session:approval.session};
test('release switches remain off and disabled/unauthorized daily requests perform no work',async()=>{
 assert.deepEqual(DATA_ACTIVATION_POLICY,{exactSlippageWrites:false,dailyInvocation:null});assert.ok(Object.isFrozen(DATA_ACTIVATION_POLICY));
 const no=()=>assert.fail('disabled request must not touch clock, schema, providers or database');
 assert.equal((await invokeApprovedDailyCollection(request,null,{authorized:true,clock:no,preflight:no,run:no})).httpStatus,409);
 assert.equal((await invokeApprovedDailyCollection(request,approval,{authorized:false,clock:no,preflight:no,run:no})).httpStatus,401);
 for(const input of [{...request,symbols:['SPY']},{...request,session:'2026-11-13'},{...request,approvalId:'wrong'}])assert.equal((await invokeApprovedDailyCollection(input,approval,{authorized:true,clock:no,preflight:no,run:no})).httpStatus,400);
});
test('manual approval checks schema, exact session and sufficient deadline; run clocks stay inside approval',async()=>{
 const stages:string[]=[];let clock=now;
 const deps={authorized:true,clock:()=>clock,preflight:async()=>{stages.push('schema');},run:async(readClock:()=>Date)=>{stages.push('run');assert.equal(+readClock(),+now);clock=new Date(+now+60000);readClock();return {saved:0};}};
 assert.equal((await invokeApprovedDailyCollection(request,approval,deps)).httpStatus,200);assert.deepEqual(stages,['schema','run']);
 await assert.rejects(invokeApprovedDailyCollection(request,approval,{...deps,clock:()=>new Date('2026-11-16T22:59:00Z'),run:async()=>assert.fail('insufficient time')}),/deadline_budget/);
 await assert.rejects(invokeApprovedDailyCollection(request,approval,{...deps,clock:()=>now,preflight:async()=>{throw Error('missing migration');},run:async()=>assert.fail()}),/migration/);
 let tick=0;
 await assert.rejects(invokeApprovedDailyCollection(request,approval,{authorized:true,clock:()=>tick++<3?now:new Date(approval.expiresAt),preflight:async()=>{},run:async(clock)=>{clock();clock();}}),/window_closed/);
});
test('intraday disabled mode retains legacy path; enabled path preflights before retrieval and never falls back after failure',async()=>{
 const stages:string[]=[];const counts={received:0,accepted:0,saved:0,rejected:[]};
 const deps:any={collect:async()=>{stages.push('collect');return {candidates:[],diagnostics:[],retrievedAt:now.toISOString()};},legacy:async()=>{stages.push('legacy');return counts;},exact:async()=>{stages.push('exact');return {...counts,storageLanes:{legacy:0,exactSlippage:0}};},sql:()=>({}),clock:()=>now,preflight:async()=>{stages.push('schema');}};
 await runIntradayIngestion(deps,false);assert.deepEqual(stages,['collect','legacy']);stages.length=0;
 await runIntradayIngestion(deps,true);assert.deepEqual(stages,['schema','collect','exact']);stages.length=0;
 await assert.rejects(runIntradayIngestion({...deps,preflight:async()=>{throw Error('schema');}},true),(e:any)=>e instanceof IntradayRunFailure&&!e.persistenceAttempted);assert.deepEqual(stages,[]);
 await assert.rejects(runIntradayIngestion({...deps,exact:async()=>{throw Error('uncertain write');}},true),(e:any)=>e instanceof IntradayRunFailure&&e.persistenceAttempted);assert.deepEqual(stages,['schema','collect']);
});
test('real schema preflight refuses missing migrations and disabled append-only triggers',async()=>{
 const pg=new PGlite();try{
  const sql=async(s:TemplateStringsArray,...v:unknown[])=>(await pg.query(s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,''),v)).rows;
  await assert.rejects(assertDataStorageReady(sql,'exact'),/not_ready/);
  await pg.exec('create table tradeos_factor_evidence(id bigserial primary key)');
  for(const file of ['20261116_exact_factor_evidence.sql','20261116_daily_factor_claims.sql'])await pg.exec(readFileSync(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
  await assertDataStorageReady(sql,'exact');await assertDataStorageReady(sql,'daily');
  await pg.exec('alter table tradeos_factor_evidence_exact disable trigger tradeos_exact_evidence_protect');
  await assert.rejects(assertDataStorageReady(sql,'exact'),/not_ready/);
  await assert.rejects(pg.query("select tradeos_assert_daily_completion(1,1,now()-interval '1 second')"),/deadline_expired/);
 }finally{await pg.close();}
});

test('actual manual POST route stays disabled even for an authenticated request naming an approval',async()=>{
 const previous=process.env.CRON_SECRET;
 try{
  process.env.CRON_SECRET='synthetic-manual-operator';
  const {POST}=await import('../app/api/operations/daily-factor-collection/route');
  const anonymous=await POST(new Request('https://fixture.invalid/api/operations/daily-factor-collection',{method:'POST',body:'not json'}));assert.equal(anonymous.status,401);
  const authorized=await POST(new Request('https://fixture.invalid/api/operations/daily-factor-collection',{method:'POST',headers:{authorization:'Bearer synthetic-manual-operator'},body:JSON.stringify(request)}));assert.equal(authorized.status,409);assert.equal((await authorized.json()).status,'daily_collection_disabled');
 }finally{if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;}
});
