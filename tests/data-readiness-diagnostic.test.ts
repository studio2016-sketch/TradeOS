import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dataReadinessDiagnostic,readOnlyDiagnosticSql} from '../lib/research/data-readiness-diagnostic';
import {DAILY_SYMBOLS,DAILY_KEYS,runDailyFactorCollection,isPinnedSession,pinnedSessionClose} from '../lib/research/daily-factor-collection';
import {invokeApprovedDailyCollection} from '../lib/research/daily-invocation';
const now=new Date('2026-11-17T07:00:00Z');
const sql=async(s:TemplateStringsArray)=>{
 const q=s.join('?');assert.match(q.trim(),/^select/i);
 if(q.includes('current_user'))return [{runtime_role:'fixture_runtime',database:'fixture',read_only:'on'}];
 return [{present:true,readable:true,writable:true,protected:true,sequence_usable:true,exact_columns:2,executable:true}];
};
function bars(){
 const rows=[];for(let day='2026-11-16';rows.length<200;day=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10))if(isPinnedSession(day))rows.unshift({timestamp:day+(pinnedSessionClose(day).includes('T20:')?'T04:00:00Z':'T05:00:00Z'),open:100,high:102,low:99,close:101,volume:1000});
 return rows.map((b,i)=>{const c=100+i*.1+Math.sin(i);return {...b,open:c,high:c+1,low:c-1,close:c,volume:1000+i};});
}
test('fixed three-symbol complete raw history returns descriptive readiness without writes',async()=>{
 const called:string[]=[];let active=0,max=0;
 const result=await dataReadinessDiagnostic({sql,feed:'iex',clock:()=>now,history:async(symbol,asOf,session)=>{called.push(symbol);active++;max=Math.max(max,active);await Promise.resolve();active--;assert.equal(asOf,now.toISOString());assert.equal(session,'2026-11-16');return {source:'Alpaca:iex',bars:bars()};}});
 assert.deepEqual(called,['NVDA','AMD','PLTR']);assert.equal(max,2);assert.equal(result.status,'ready_for_activation_review');
 assert.equal(result.runtime.role,'fixture_runtime');assert.equal(result.persistentWrites,false);assert.equal(result.executionAllowed,false);
 assert.ok(result.histories.every(h=>h.ready&&h.factorCount===24));assert.ok(!JSON.stringify(result).includes('timestamp'));
});
test('missing sessions, short raw history and failed schema cannot report readiness',async()=>{
 for(const history of [{source:'Alpaca:iex',bars:bars().slice(1)},{source:'Alpaca:iex',bars:bars().filter((_,i)=>i!==100)},{source:'Alpaca:delayed_sip',bars:bars()}]){
  const result=await dataReadinessDiagnostic({sql,feed:'iex',clock:()=>now,history:async()=>history});assert.equal(result.status,'blocked');assert.ok(result.histories.every(h=>!h.ready));
 }
 const failSchema=async(s:TemplateStringsArray)=>{if(s.join('').includes('current_user'))return sql(s);throw Error('postgres://secret');};
 const result=await dataReadinessDiagnostic({sql:failSchema,feed:'iex',clock:()=>now,history:async()=>({source:'Alpaca:iex',bars:bars()})});
 assert.equal(result.status,'blocked');assert.deepEqual(result.storage,{exact:{ready:false},daily:{ready:false}});assert.ok(!JSON.stringify(result).includes('secret'));
});
test('provider errors are sanitized; non-IEX/read-write runtime and deadline stop work',async()=>{
 const deps={sql,feed:'iex',clock:()=>now,history:async()=>({source:'Alpaca:iex',bars:[],error:'secret-provider-body'})};
 const result=await dataReadinessDiagnostic(deps);assert.ok(!JSON.stringify(result).includes('secret'));assert.equal(result.status,'blocked');
 const never=async()=>assert.fail('must not fetch');
 await assert.rejects(dataReadinessDiagnostic({...deps,feed:'sip',history:never}),/requires_iex/);
 await assert.rejects(dataReadinessDiagnostic({...deps,sql:async()=>[{runtime_role:'x',database:'x',read_only:'off'}],history:never}),/read_only_required/);
 let calls=0;await assert.rejects(dataReadinessDiagnostic({...deps,clock:()=>new Date(+now+(calls++?55000:0)),history:never}),/deadline/);
});
test('database adapter forces read-only transaction and passes bounded cancellation',async()=>{
 const signal=AbortSignal.timeout(1000);let seen=false;
 const driver:any=(s:any,...v:any[])=>({s,v});driver.transaction=async(q:any[],opts:any)=>{seen=true;assert.equal(opts.readOnly,true);assert.equal(opts.fetchOptions.signal,signal);assert.equal(q.length,1);return [[{ok:true}]];};
 assert.deepEqual(await readOnlyDiagnosticSql(driver,signal)`select ${1}`, [{ok:true}]);assert.ok(seen);
});
test('actual endpoint denies anonymous/parameterized calls before DB access and sanitizes configuration failure',async()=>{
 const old={secret:process.env.CRON_SECRET,db:process.env.DATABASE_URL};
 try{
  process.env.CRON_SECRET='fixture-operator';delete process.env.DATABASE_URL;
  const {POST}=await import('../app/api/operations/data-readiness/route');
  assert.equal((await POST(new Request('https://fixture.invalid/data',{method:'POST'}))).status,401);
  for(const req of [new Request('https://fixture.invalid/data?symbol=SPY',{method:'POST',headers:{authorization:'Bearer fixture-operator'}}),new Request('https://fixture.invalid/data',{method:'POST',headers:{authorization:'Bearer fixture-operator'},body:'{}'})])assert.equal((await POST(req)).status,400);
  const failed=await POST(new Request('https://fixture.invalid/data',{method:'POST',headers:{authorization:'Bearer fixture-operator'}}));assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('DATABASE_URL'));
 }finally{for(const [key,value] of [['CRON_SECRET',old.secret],['DATABASE_URL',old.db]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;}
 const config=JSON.parse(readFileSync('vercel.json','utf8'));assert.equal(config.git.deploymentEnabled['fix/read-only-data-diagnostic'],false);assert.ok(!config.crons.some((x:any)=>x.path.includes('data-readiness')));
});

test('slow preflight cannot start a fresh 12-second provider timeout near the shared deadline',async()=>{
 let elapsed=0,calls=0;
 const slowSql=async(s:TemplateStringsArray)=>{const rows=await sql(s);elapsed=54000;return rows;};
 await assert.rejects(dataReadinessDiagnostic({sql:slowSql,feed:'iex',clock:()=>new Date(+now+elapsed),history:async()=>{calls++;return {source:'Alpaca:iex',bars:bars()};}}),/provider_budget/);
 assert.equal(calls,0);
});
test('second batch must retain full provider timeout and response margin',async()=>{
 let elapsed=0;const called:string[]=[];
 await assert.rejects(dataReadinessDiagnostic({sql,feed:'iex',clock:()=>new Date(+now+elapsed),history:async(symbol)=>{
  called.push(symbol);await Promise.resolve();elapsed=40001;return {source:'Alpaca:iex',bars:bars()};
 }}),/provider_budget/);
 assert.deepEqual(called,['NVDA','AMD']);
});
test('budget boundary reserves twelve seconds plus three seconds; one millisecond late starts no request',async()=>{
 for(const initialElapsed of [40000,40001]){
  let elapsed=0;const called:string[]=[];
  const delayedSql=async(s:TemplateStringsArray)=>{const rows=await sql(s);elapsed=initialElapsed;return rows;};
  await assert.rejects(dataReadinessDiagnostic({sql:delayedSql,feed:'iex',clock:()=>new Date(+now+elapsed),history:async(symbol)=>{
   called.push(symbol);await Promise.resolve();elapsed=52000;return {source:'Alpaca:iex',bars:bars()};
  }}),/provider_budget/);
  assert.deepEqual(called,initialElapsed===40000?['NVDA','AMD']:[]);
 }
});

// These fixtures reproduce readiness logic; they are not recovered production results.
test('each individual pilot symbol can veto aggregate readiness, including the last batch',async()=>{
 assert.deepEqual(DAILY_SYMBOLS,['NVDA','AMD','PLTR']);assert.equal(DAILY_KEYS.length,24);
 for(const failed of DAILY_SYMBOLS){
  const called:string[]=[];
  const result=await dataReadinessDiagnostic({sql,feed:'iex',clock:()=>now,history:async symbol=>{called.push(symbol);return {source:'Alpaca:iex',bars:symbol===failed?bars().slice(1):bars()};}});
  assert.deepEqual(called,[...DAILY_SYMBOLS]);assert.equal(result.status,'blocked');
  assert.deepEqual(result.histories.filter(h=>!h.ready).map(h=>h.symbol),[failed]);
  assert.equal(result.histories.filter(h=>h.ready&&h.factorCount===24).length,2);
 }
});
test('aggregate readiness waits for PLTR, never returns after only the first two symbols',async()=>{
 let release!:()=>void,started!:()=>void,settled=false;
 const lastStarted=new Promise<void>(resolve=>{started=resolve;});
 const wait=new Promise<void>(resolve=>{release=resolve;});
 const pending=dataReadinessDiagnostic({sql,feed:'iex',clock:()=>now,history:async symbol=>{
  if(symbol==='PLTR'){started();await wait;}return {source:'Alpaca:iex',bars:bars()};
 }}).then(result=>{settled=true;return result;});
 await lastStarted;assert.equal(settled,false);release();
 const result=await pending;assert.equal(result.status,'ready_for_activation_review');assert.equal(result.histories.length,3);
});
test('approved single-session pilot composes bounded invocation and collector with at most 72 candidates',async()=>{
 const approval={id:'fixture-pilot',session:'2026-11-16',opensAt:now.toISOString(),expiresAt:new Date(+now+15*60000).toISOString()};
 const input={approvalId:approval.id,session:approval.session};
 let claimed=false,finishes=0;const calls:string[]=[];
 const run=(clock:()=>Date)=>runDailyFactorCollection({clock,claim:async()=>{if(claimed)return false;claimed=true;return true;},history:async symbol=>{calls.push(symbol);return {source:'Alpaca:iex',bars:bars()};},finish:async(plan,result)=>{
  finishes++;assert.equal(plan.session,approval.session);assert.equal(result.evidence.length,72);
  assert.equal(new Set(result.evidence.map(e=>e.subject+':'+e.factor)).size,72);
  assert.ok(result.evidence.every(e=>e.availableAt===result.details.finishedAt));return result.evidence.length;
 }});
 const deps={authorized:true,clock:()=>now,preflight:async()=>{},run};
 const first=await invokeApprovedDailyCollection(input,approval,deps);assert.equal(first.httpStatus,200);
 assert.deepEqual((first.body as any).result,{status:'observed_not_certified',candidates:72,saved:72,session:approval.session});
 const duplicate=await invokeApprovedDailyCollection(input,approval,deps);
 assert.deepEqual((duplicate.body as any).result,{status:'already_attempted',saved:0});assert.equal(finishes,1);assert.deepEqual(calls,[...DAILY_SYMBOLS]);
});
test('pilot partial completion is explicit and does not invent the failed symbol evidence',async()=>{
 const result=await runDailyFactorCollection({clock:()=>now,claim:async()=>true,history:async symbol=>symbol==='PLTR'?{source:'Alpaca:iex',bars:[],error:'fetch_failed'}:{source:'Alpaca:iex',bars:bars()},finish:async(_,r)=>{
  assert.equal(r.evidence.length,48);assert.ok(r.evidence.every(e=>e.subject!=='PLTR'));
  assert.equal((r.details.histories as any).PLTR.error,'fetch_failed');return r.evidence.length;
 }});
 assert.equal(result.status,'observed_not_certified');assert.equal(result.saved,48);
});
