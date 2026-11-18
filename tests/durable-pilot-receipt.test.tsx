import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
import {dailyCollectionPlan,runDailyFactorCollection,isPinnedSession,pinnedSessionClose} from '../lib/research/daily-factor-collection';
import {readPilotReceipt,summarizePilotSnapshot} from '../lib/research/durable-pilot-receipt';
import Receipt from '../app/operations/daily-pilot/receipt';
const checked='2026-11-18T04:00:00.000Z';
async function fixture(){
 const now=new Date('2026-11-17T22:00:00Z'),plan=dailyCollectionPlan(now),bars:any[]=[];let candidate:any;
 for(let day='2026-01-02';day<=plan.session;day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10))if(isPinnedSession(day)){
  const c=100+bars.length*.1+Math.sin(bars.length);bars.push({timestamp:day+(pinnedSessionClose(day).includes('T20:')?'T04:00:00Z':'T05:00:00Z'),open:c,high:c+1,low:c-1,close:c,volume:1000+bars.length});}
 await runDailyFactorCollection({clock:()=>now,claim:async()=>true,history:async()=>({source:'Alpaca:iex',bars}),finish:async(_p,r)=>{candidate=r;return r.evidence.length}},true);
 return {session:plan.session,claim:{session:plan.session,policy:plan.policy,started_at:plan.startedAt,expires_at:plan.expiresAt},completion:{session:plan.session,saved:72,details:candidate.details},evidence:candidate.evidence.map((e:any)=>({factor_key:e.factor,domain:e.domain,subject:e.subject,value:e.value,source_name:e.source,observed_at:e.observedAt,available_at:e.availableAt,source_metadata:{...e.metadata,evidenceIntake:{observedAt:e.observedAt,availableAt:e.availableAt,policyVersion:'tradeos.evidence-intake.v2',persistenceTimePolicy:'tradeos.evidence-persistence.microseconds.v1'}}}))};
}
test('only successful durable replay becomes verified; summary excludes private raw data',async()=>{
 const input=await fixture(),r=summarizePilotSnapshot(input,checked);assert.equal(r.status,'verified');assert.equal(r.verifiedIdentities,72);assert.equal(r.newlySaved,72);assert.equal(r.ordersAllowed,false);assert.equal(r.certified,false);
 const json=JSON.stringify(r);for(const key of ['inputSha256','source_metadata','histories','close','volume','value'])assert.ok(!json.includes('"'+key+'"'),key);
 input.evidence[0].value+=1;assert.equal(summarizePilotSnapshot(input,checked).status,'unverified');
});
test('none, missing completion, invalid scope and verifier failure are not success or safe retry',async()=>{
 assert.equal(summarizePilotSnapshot(null,checked).status,'none');assert.equal(summarizePilotSnapshot({},checked).status,'unavailable');
 const r=await fixture();assert.equal(summarizePilotSnapshot({...r,completion:null},checked).status,'claimed');
 assert.equal(summarizePilotSnapshot({...r,claim:null},checked).status,'unverified');
 assert.equal(summarizePilotSnapshot({...r,session:'2026-02-30'},checked).status,'unavailable');
 r.completion.saved=0;assert.equal(summarizePilotSnapshot(r,checked).newlySaved,0);
});
test('actual SQL snapshot survives PostgreSQL JSONB order and reload, reads only latest attempt, caps corrupt evidence',async()=>{
 const pg=new PGlite(),r=await fixture();let reads=0;
 const sql=async(s:TemplateStringsArray,...v:unknown[])=>{reads++;const q=s.reduce((a,x,i)=>a+(i?'$'+i:'')+x,'');assert.ok(q.trim().startsWith('with latest'));return(await pg.query(q,v)).rows};
 try{
  await pg.exec(`create table tradeos_daily_factor_claims(session date,policy text,started_at timestamptz,expires_at timestamptz);create table tradeos_daily_factor_completions(session date,saved integer,details jsonb);create table tradeos_factor_evidence(factor_key text,domain text,subject text,value double precision,source_name text,observed_at timestamptz,available_at timestamptz,source_metadata jsonb);`);
  assert.equal((await readPilotReceipt(sql,checked)).status,'none');
  await pg.query('insert into tradeos_daily_factor_claims values($1,$2,$3,$4)',Object.values(r.claim));
  assert.equal((await readPilotReceipt(sql,checked)).status,'claimed');
  await pg.query('insert into tradeos_daily_factor_completions values($1,$2,$3)',[r.session,72,JSON.stringify(r.completion.details)]);
  for(const e of r.evidence)await pg.query('insert into tradeos_factor_evidence values($1,$2,$3,$4,$5,$6,$7,$8)',[e.factor_key,e.domain,e.subject,e.value,e.source_name,e.observed_at,e.available_at,JSON.stringify(e.source_metadata)]);
  const first=await readPilotReceipt(sql,checked);assert.equal(first.status,'verified');assert.deepEqual(await readPilotReceipt(sql,checked),first);assert.equal(reads,4);
  await pg.exec('insert into tradeos_factor_evidence select * from tradeos_factor_evidence limit 1');assert.equal((await readPilotReceipt(sql,checked)).status,'unverified');
  await pg.query('insert into tradeos_daily_factor_claims values($1,$2,$3,$4)',['2026-11-18',r.claim.policy,'2026-11-18T22:00:00Z','2026-11-18T22:01:30Z']);
  const last=await readPilotReceipt(sql,checked);assert.equal(last.session,'2026-11-18');assert.equal(last.status,'claimed');
 }finally{await pg.close()}
});
test('database errors never leak SQL, credentials or receipt content',async()=>{
 const r=await readPilotReceipt(async()=>{throw Error('postgres://secret/PRIVATE')},checked);assert.equal(r.status,'unavailable');assert.ok(!JSON.stringify(r).includes('secret'));
});
test('receipt rendering separates collection proof, historical status and blocked authority in all states',async()=>{
 for(const r of [summarizePilotSnapshot(await fixture(),checked),summarizePilotSnapshot(null,checked),{status:'claimed' as const,session:'2026-11-17',checkedAt:checked,ordersAllowed:false as const,certified:false as const},{status:'unavailable' as const,checkedAt:checked,ordersAllowed:false as const,certified:false as const}]){
  const html=renderToStaticMarkup(<Receipt receipt={r}/>);for(const text of ['Scientific certification: blocked','Order execution: blocked','historical receipt','Refresh saved receipt (read only)'])assert.ok(html.includes(text));assert.ok(!html.includes('<button'));assert.ok(!html.includes('method="post"'));
 }
});
test('owner server gate precedes receipt read; no new collection/provider operation or API route',()=>{
 const page=readFileSync(new URL('../app/operations/daily-pilot/page.tsx',import.meta.url),'utf8');assert.ok(page.indexOf('if(status!==200)return')<page.indexOf('const receipt=await currentPilotReceipt()'));assert.match(page,/dynamic="force-dynamic"/);
 const source=readFileSync(new URL('../lib/research/durable-pilot-receipt.ts',import.meta.url),'utf8');assert.match(source,/budget.sql\(db\(\),true\)/);assert.match(source,/Date.now\(\),8000/);for(const forbidden of ['fetch(','insert into','update tradeos','delete from','runPreparedDailyFactorCollection','invokeApprovedDailyCollection'])assert.ok(!source.includes(forbidden));
});
