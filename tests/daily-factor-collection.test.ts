import test from 'node:test';
import assert from 'node:assert/strict';
import {DAILY_KEYS,dailyCollectionPlan,dailySymbolEvidence,isPinnedSession,pinnedSessionClose,runDailyFactorCollection} from '../lib/research/daily-factor-collection';
const now=new Date('2026-11-16T22:00:00Z');
const plan=dailyCollectionPlan(now);
export function syntheticDailyHistory(){
 const bars:import('../lib/research/market-factor-engine').PriceBar[]=[];
 for(let day='2026-01-02';day<=plan.session;day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10)){
  if(!isPinnedSession(day))continue;
  const close=pinnedSessionClose(day),summer=close.includes('T20:');
  const c:number=100+bars.length*.1+Math.sin(bars.length);
  bars.push({timestamp:day+(summer?'T04:00:00.000Z':'T05:00:00.000Z'),open:c,high:c+1,low:c-1,close:c,volume:1000+bars.length});
 }
 return {bars,source:'Alpaca:iex'};
}
const history=syntheticDailyHistory();
test('latest completed session respects weekends, holidays, early close and finalization delay',()=>{
 for(const [time,expected] of [['2026-11-16T14:00:00Z','2026-11-13'],['2026-11-16T22:00:00Z','2026-11-16'],['2026-11-26T22:00:00Z','2026-11-25'],['2026-11-27T18:15:00Z','2026-11-27'],['2026-11-29T18:00:00Z','2026-11-27']])assert.equal(dailyCollectionPlan(new Date(time)).session,expected);
 for(const time of ['2026-11-16T21:00:00Z','2026-11-27T18:14:59Z','2027-01-04T22:00:00Z','2026-11-04T22:00:00Z','invalid'])assert.throws(()=>dailyCollectionPlan(new Date(time)));
 assert.equal(pinnedSessionClose('2026-03-09'),'2026-03-09T20:00:00.000Z');
 assert.equal(pinnedSessionClose('2026-11-16'),'2026-11-16T21:00:00.000Z');
});
test('24 factors use exactly the last 200 complete sessions with traceable inputs',()=>{
 const result=dailySymbolEvidence('NVDA',history,plan);
 assert.equal(result.evidence.length,24);assert.deepEqual(result.evidence.map(x=>x.factor),[...DAILY_KEYS]);
 assert.ok('bars' in result.provenance);
 assert.equal(result.provenance.bars.length,200);
 for(const row of result.evidence){assert.equal(row.observedAt,history.bars.at(-1)!.timestamp);assert.equal(row.metadata?.inputSha256,result.provenance.inputSha256);}
});
test('stale, gapped, duplicate, malformed, non-session, intraday and wrong-feed history remains unavailable',()=>{
 const last=history.bars.at(-1)!;
 for(const bad of [
  {...history,bars:history.bars.slice(0,-1)}, {...history,bars:history.bars.filter((_,i)=>i!==history.bars.length-4)},
  {...history,bars:[...history.bars,last]}, {...history,bars:[{...last,timestamp:'2026-11-16T16:00:00Z'}]},
  {...history,bars:[{...last,timestamp:'2026-11-15T05:00:00Z'}]}, {...history,bars:[{...last,close:NaN}]},
  {...history,source:'Alpaca:sip'}, {...history,error:'pagination_incomplete'}, {...history,bars:[]},
 ])assert.equal(dailySymbolEvidence('NVDA',bad,plan).evidence.length,0);
 assert.throws(()=>dailySymbolEvidence('SPY',history,plan),/scope/);
});
test('one claim, three bounded calls, concurrency two; availability sampled after all extraction',async()=>{
 let claimed=false,calls=0,active=0,peak=0,tick=0,written:any;
 const deps={clock:()=>new Date(+now+tick++),claim:async()=>{if(claimed)return false;claimed=true;return true;},history:async(symbol:string,cutoff:string,session:string)=>{
  calls++;active++;peak=Math.max(active,peak);assert.equal(session,plan.session);assert.equal(cutoff,now.toISOString());await Promise.resolve();active--;return history;
 },finish:async(_p:any,r:any)=>{written=r;return r.evidence.length;}};
 const result=await runDailyFactorCollection(deps);assert.equal(result.saved,72);assert.equal(calls,3);assert.equal(peak,2);
 for(const row of written.evidence)assert.equal(row.availableAt,written.details.finishedAt);
 assert.equal((await runDailyFactorCollection(deps)).status,'already_attempted');assert.equal(calls,3);
});
test('deadline, backwards clocks and crossing session close fail without finalization; partial failures never retry',async()=>{
 for(const bad of [new Date(+now-1),new Date(+now+120000)]){
  let clocks=0,finished=false;
  await assert.rejects(runDailyFactorCollection({clock:()=>clocks++===0?now:bad,claim:async()=>true,history:async()=>history,finish:async()=>{finished=true;return 0;}}));assert.equal(finished,false);
 }
 let calls=0;
 const result=await runDailyFactorCollection({clock:()=>now,claim:async()=>true,history:async(symbol)=>{calls++;if(symbol==='AMD')throw Error('fixture');return history;},finish:async(_p,r)=>r.evidence.length});
 assert.equal(calls,3);assert.equal(result.saved,48);
});

import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {dailyFactorStore} from '../lib/research/daily-factor-store';
async function storeFixture(){
 const pg=new PGlite();
 await pg.exec(`create table tradeos_factor_evidence(id serial primary key,factor_key text,domain text,subject text,value double precision,source_name text,observed_at timestamptz,available_at timestamptz,source_metadata jsonb,
 unique(factor_key,domain,subject,source_name,observed_at,available_at));`);
 await pg.exec(readFileSync(new URL('../db/migrations/20261116_daily_factor_claims.sql',import.meta.url),'utf8').replaceAll('clock_timestamp()',"'2026-11-16T22:00:00Z'::timestamptz"));
 const sql=async(s:TemplateStringsArray,...v:unknown[])=>{
  const query=s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,'').replaceAll('clock_timestamp()',"'2026-11-16T22:00:00Z'::timestamptz");
  return (await pg.query(query,v)).rows;
 };
 return {pg,sql};
}
test('durable SQL claim deduplicates independent collectors and atomic completion saves bounded evidence',async()=>{
 const {pg,sql}=await storeFixture();try{
  const store=dailyFactorStore(sql,()=>now);
  const result=await runDailyFactorCollection({...store,clock:()=>now,history:async()=>history});assert.equal(result.saved,72);
  const again=await runDailyFactorCollection({...dailyFactorStore(sql,()=>now),clock:()=>now,history:async()=>assert.fail('must not fetch')});assert.equal(again.status,'already_attempted');
  const receipts=await pg.query<any>('select * from tradeos_daily_factor_completions');assert.equal(receipts.rows.length,1);assert.equal(receipts.rows[0].saved,72);
  assert.equal(receipts.rows[0].details.histories.NVDA.bars.length,200);
  for(const table of ['tradeos_daily_factor_claims','tradeos_daily_factor_completions'])for(const command of [`delete from ${table}`,`truncate ${table} cascade`])await assert.rejects(pg.exec(command),/append-only/);
 }finally{await pg.close();}
});
test('failed atomic insert preserves consumed claim and writes neither evidence nor completion',async()=>{
 const {pg,sql}=await storeFixture();try{
  await pg.exec("alter table tradeos_factor_evidence add check(factor_key='fixture_reject')");
  await assert.rejects(runDailyFactorCollection({...dailyFactorStore(sql,()=>now),clock:()=>now,history:async()=>history}),/check constraint/);
  for(const table of ['tradeos_factor_evidence','tradeos_daily_factor_completions'])assert.equal((await pg.query<any>(`select count(*)::int n from ${table}`)).rows[0].n,0);
  assert.equal(await dailyFactorStore(sql,()=>now).claim(plan),false);
 }finally{await pg.close();}
});
test('store independently replays provenance and rejects tampered values before inserting',async()=>{
 const {pg,sql}=await storeFixture();try{
  const store=dailyFactorStore(sql,()=>now);let result:any;
  await runDailyFactorCollection({clock:()=>now,claim:store.claim,history:async()=>history,finish:async(_p,r)=>{result=r;return 0;}});
  result.evidence[0].value+=1;
  await assert.rejects(store.finish(plan,result),/replay_mismatch/);
  assert.equal((await pg.query<any>('select count(*)::int n from tradeos_factor_evidence')).rows[0].n,0);
 }finally{await pg.close();}
});
test('database wall clock independently rejects an expired claim despite a valid application clock',async()=>{
 const {pg,sql}=await storeFixture();try{
  const lateSql=async(s:TemplateStringsArray,...v:unknown[])=>(await pg.query(s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,'').replaceAll('clock_timestamp()',"'2026-11-16T22:02:00Z'::timestamptz"),v)).rows;
  assert.equal(await dailyFactorStore(lateSql,()=>now).claim(plan),false);
  assert.equal(await dailyFactorStore(sql,()=>now).claim(plan),true);
 }finally{await pg.close();}
});

test('crossing the next close expires yesterday’s plan before a provider call',async()=>{
 let tick=0,calls=0;
 await assert.rejects(runDailyFactorCollection({clock:()=>new Date(tick++===0?'2026-11-16T20:59:59Z':'2026-11-16T21:00:00Z'),claim:async()=>true,history:async()=>{calls++;return history;},finish:async()=>assert.fail('must not finish')}));
 assert.equal(calls,0);
 assert.throws(()=>pinnedSessionClose('2026-02-30'));
});
test('expired SQL finalization leaves evidence and completion empty while retaining claim',async()=>{
 const {pg,sql}=await storeFixture();try{
  let expired=false;
  const timeSql=async(s:TemplateStringsArray,...v:unknown[])=>(await pg.query(s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,'').replaceAll('clock_timestamp()',expired?"'2026-11-16T22:02:00Z'::timestamptz":"'2026-11-16T22:00:00Z'::timestamptz"),v)).rows;
  const store=dailyFactorStore(timeSql,()=>now);
  await assert.rejects(runDailyFactorCollection({clock:()=>now,claim:store.claim,history:async()=>history,finish:async(p,r)=>{expired=true;return store.finish(p,r);}}),/expired/);
  assert.equal((await pg.query<any>('select count(*)::int n from tradeos_factor_evidence')).rows[0].n,0);
  assert.equal((await pg.query<any>('select count(*)::int n from tradeos_daily_factor_completions')).rows[0].n,0);
  assert.equal(await dailyFactorStore(sql,()=>now).claim(plan),false);
 }finally{await pg.close();}
});

import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
test('conflicting existing value or provenance aborts every new row and never completes the consumed claim',async()=>{
 for(const change of [{value:99999},{metadata:{conflicting:true}}]){
  const {pg,sql}=await storeFixture();try{
   const store=dailyFactorStore(sql,()=>now);let captured:any;
   await runDailyFactorCollection({clock:()=>now,claim:store.claim,history:async()=>history,finish:async(_p,r)=>{captured=r;return 0;}});
   const existing={...captured.evidence[0],...change};
   await persistEvidenceWithSql(sql,[existing],now);
   await assert.rejects(store.finish(plan,captured),/conflicting_or_unverified_daily_evidence_identity/);
   assert.equal((await pg.query<any>('select count(*)::int n from tradeos_factor_evidence')).rows[0].n,1);
   assert.equal((await pg.query<any>('select count(*)::int n from tradeos_daily_factor_completions')).rows[0].n,0);
   assert.equal((await pg.query<any>('select count(*)::int n from tradeos_daily_factor_claims')).rows[0].n,1);
   assert.equal(await dailyFactorStore(sql,()=>now).claim(plan),false);
  }finally{await pg.close();}
 }
});
test('identical preexisting evidence is an idempotent replay with accurate saved count',async()=>{
 const {pg,sql}=await storeFixture();try{
  const store=dailyFactorStore(sql,()=>now);let captured:any;
  await runDailyFactorCollection({clock:()=>now,claim:store.claim,history:async()=>history,finish:async(_p,r)=>{captured=r;return 0;}});
  await persistEvidenceWithSql(sql,[captured.evidence[0]],now);
  assert.equal(await store.finish(plan,captured),71);
  assert.equal((await pg.query<any>('select count(*)::int n from tradeos_factor_evidence')).rows[0].n,72);
  assert.equal((await pg.query<any>('select saved from tradeos_daily_factor_completions')).rows[0].saved,71);
 }finally{await pg.close();}
});
