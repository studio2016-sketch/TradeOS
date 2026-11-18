import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {dailyRequestBudget,dailyRequestText,DAILY_REQUEST_BUDGET_MS,DAILY_RUN_BUDGET_MS} from '../lib/research/daily-request-budget';
import {ownerDailyPilotRequest} from '../lib/research/owner-daily-pilot';
import {dailyCollectionPlan,runDailyFactorCollection,isPinnedSession,pinnedSessionClose} from '../lib/research/daily-factor-collection';
import {dailyFactorStore} from '../lib/research/daily-factor-store';
const now=new Date('2026-11-16T22:00:00Z');
function history(){const bars=[];for(let day='2026-01-02';day<='2026-11-16';day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10))if(isPinnedSession(day)){const c:number=100+bars.length*.1+Math.sin(bars.length);bars.push({timestamp:day+(pinnedSessionClose(day).includes('T20:')?'T04:00:00Z':'T05:00:00Z'),open:c,high:c+1,low:c-1,close:c,volume:1000+bars.length});}return {source:'Alpaca:iex',bars};}
const url='https://tradeos-lac.vercel.app/api/operations/owner-daily-pilot';
const headers={origin:'https://tradeos-lac.vercel.app','sec-fetch-site':'same-origin','x-tradeos-daily-pilot':'owner-pilot-v1'};
const request=(extra:RequestInit={},target=url)=>new Request(target,{method:'POST',headers,...extra});
test('shared budget reserves 15 seconds, requires full 90-second collection budget and rejects clock regression',async()=>{
 let t=+now;const budget=dailyRequestBudget(()=>t);
 await budget.run(async()=>{assert.equal(DAILY_REQUEST_BUDGET_MS,105000);assert.equal(DAILY_RUN_BUDGET_MS,90000);t+=15000;budget.requireRunBudget();t++;assert.throws(()=>budget.requireRunBudget(),/start_budget/);t--;assert.throws(()=>budget.clock(),/deadline/);});
 assert.ok(budget.signal.aborted);assert.throws(()=>budget.clock());
});
test('deadline abort returns promptly, rejects late SQL and cannot continue into a new write',async()=>{
 const budget=dailyRequestBudget(()=>+now,10);let called=0;
 const driver:any=()=>{called++;};driver.transaction=()=>assert.fail('must not start');
 await assert.rejects(budget.run(()=>new Promise(()=>{})),/deadline/);
 await assert.rejects(budget.sql(driver)`select 1`,/deadline/);assert.equal(called,0);
});
test('database transport shares cancellation and sets explicit read-only mode for authorization/preflight',async()=>{
 const budget=dailyRequestBudget(()=>+now);const modes:boolean[]=[];
 const driver:any=(s:any,v:any)=>({s,v});driver.transaction=async(q:any,options:any)=>{assert.equal(options.fetchOptions.signal,budget.signal);modes.push(options.readOnly);return [[{ok:true}]];};
 await budget.run(async()=>{await budget.sql(driver,true)`select 1`;await budget.sql(driver)`insert into fixture values(1)`;});assert.deepEqual(modes,[true,false]);
});
test('request parsing accepts empty streams and bounds bytes, stalls, broken streams and invalid UTF-8',async()=>{
 assert.equal(await dailyRequestText(request()),'');assert.equal(await dailyRequestText(request({body:'{}'})),'{}');
 await assert.rejects(dailyRequestText(request({body:'x'.repeat(513),headers:{...headers,'content-length':'0'}})),/too_large/);
 const stream=(body:ReadableStream)=>request({body,duplex:'half'} as RequestInit);
 await assert.rejects(dailyRequestText(stream(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){return new Promise(()=>{});}})),5),/timeout/);
 await assert.rejects(dailyRequestText(stream(new ReadableStream({start(c){c.error(Error('broken'));}}))),/broken/);
 await assert.rejects(dailyRequestText(stream(new ReadableStream({start(c){c.enqueue(new Uint8Array([255]));c.close();}}))));
});
test('owner pilot requires production same-origin POST and dedicated CSRF header; no caller scope',()=>{
 assert.equal(ownerDailyPilotRequest(request()),true);
 for(const r of [request({method:'GET'}),request({headers:{...headers,origin:'https://evil.invalid'}}),request({headers:{...headers,'sec-fetch-site':'cross-site'}}),request({headers:{}}),request({},url+'?session=2026-11-16'),request({},url.replace('tradeos-lac','preview'))])assert.equal(ownerDailyPilotRequest(r),false);
});
test('strict pilot refuses one failed symbol before persistence and consumes claim without retry',async()=>{
 let claimed=false,called=0;const deps={clock:()=>now,claim:async()=>{if(claimed)return false;claimed=true;return true;},history:async(symbol:string)=>{called++;return symbol==='PLTR'?{source:'Alpaca:iex',bars:[],error:'failed'}:history();},finish:async()=>assert.fail('partial pilot must not persist')};
 await assert.rejects(runDailyFactorCollection(deps,true),/incomplete/);
 assert.deepEqual(await runDailyFactorCollection(deps,true),{status:'already_attempted',saved:0});assert.equal(called,3);
});
test('provider batch must fit full 12-second timeout and 3-second response/persistence margin',async()=>{
 let elapsed=0;const called:string[]=[];
 await assert.rejects(runDailyFactorCollection({clock:()=>new Date(+now+elapsed),claim:async()=>true,history:async symbol=>{called.push(symbol);await Promise.resolve();elapsed=75001;return history();},finish:async()=>assert.fail()},true),/provider_budget/);
 assert.deepEqual(called,['NVDA','AMD']);assert.equal(Date.parse(dailyCollectionPlan(now).expiresAt)-+now,90000);
});
test('strict store rejects partial completion independently; conflict rolls back all 72 inserts and completion',async()=>{
 const pg=new PGlite();try{
 await pg.exec('create table tradeos_factor_evidence(id bigserial primary key,factor_key text,domain text,subject text,value double precision,source_name text,observed_at timestamptz,available_at timestamptz,source_metadata jsonb,unique(factor_key,domain,subject,source_name,observed_at,available_at));');
 await pg.exec(readFileSync('db/migrations/20261116_daily_factor_claims.sql','utf8'));
 const sql=async(s:TemplateStringsArray,...v:unknown[])=>(await pg.query(s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,'').replaceAll('clock_timestamp()',"'2026-11-16T22:00:00Z'::timestamptz"),v)).rows;
 const store=dailyFactorStore(sql,()=>now,true);const plan=dailyCollectionPlan(now);
 await assert.rejects(store.finish(plan,{evidence:[],details:{}}),/incomplete/);
 await assert.rejects(runDailyFactorCollection({clock:()=>now,claim:store.claim,history:async()=>history(),finish:async(p,r)=>{
  const e=r.evidence[0];await pg.query('insert into tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata) values($1,$2,$3,99999,$4,$5,$6,$7)',[e.factor,e.domain,e.subject,e.source,e.observedAt,e.availableAt,'{}']);
  return store.finish(p,r);
 }},true),/conflict|mismatch/i);
 assert.equal((await pg.query<any>('select count(*)::int n from tradeos_factor_evidence')).rows[0].n,1);
 assert.equal((await pg.query<any>('select count(*)::int n from tradeos_daily_factor_completions')).rows[0].n,0);
 assert.equal((await pg.query<any>('select count(*)::int n from tradeos_daily_factor_claims')).rows[0].n,1);
 }finally{await pg.close();}
});

test('pilot owner authorization rejects SDK errors before SQL and malformed account states',async()=>{
 const {ownerDailyPilotStatus}=await import('../lib/research/owner-daily-pilot');
 let reads=0;
 const session=async()=>({data:{user:{id:'owner'}}});
 const row={id:'owner',role:'admin',verified:true,banned:false as unknown};
 const sql:any=async()=>{reads++;return [row];};
 const check=(s:()=>Promise<unknown>=session)=>ownerDailyPilotStatus(s,()=>'owner',sql);
 assert.equal(await check(async()=>({data:{user:{id:'owner'}},error:{message:'untrusted session'}})),503);
 assert.equal(await check(async()=>null),401);assert.equal(reads,0);
 for(const banned of [false,null]){row.banned=banned;assert.equal(await check(),200);}
 for(const banned of [undefined,'false',0,true]){row.banned=banned;assert.equal(await check(),403);}
 row.banned=false;row.id='other';assert.equal(await check(),403);
});
