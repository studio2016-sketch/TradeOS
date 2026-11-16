/** Disposable loopback-only fixture. Never accepts DATABASE_URL or a remote host. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {persistExactEvidenceWithSql,readExactEvidenceAtDecisionWithSql} from '../lib/research/exact-evidence-store';
import {readSlippageCoverage,readSlippageAtDecisionWithSql} from '../lib/research/slippage-coverage-reader';
import {assertDataStorageReady} from '../lib/research/data-storage-readiness';
import {dailyFactorStore} from '../lib/research/daily-factor-store';
import {dailyCollectionPlan,isPinnedSession,pinnedSessionClose,runDailyFactorCollection} from '../lib/research/daily-factor-collection';
async function main(){
 assert.equal(process.argv[2],'--disposable-local-pg-55439');
 const {default:pg}=await import(pathToFileURL(resolve('../tradeos-local-postgres/node_modules/pg/lib/index.js')).href);
 const settings={host:'127.0.0.1',port:55439,user:'agent',database:'postgres',connectionTimeoutMillis:3000};
 const admin=new pg.Client(settings);await admin.connect();
 const directory=(await admin.query('show data_directory')).rows[0].data_directory;
 assert.equal(directory,resolve('../tradeos-local-postgres/cluster'));
 const suffix=Date.now().toString(),database='tradeos_fixture_'+suffix,writer='fixture_writer_'+suffix,reader='fixture_reader_'+suffix;
 const clients:any[]=[];const checks:string[]=[];
 const client=async(user='agent')=>{const c=new pg.Client({...settings,database,user});await c.connect();clients.push(c);return c;};
 const sql=(c:any)=>async(s:TemplateStringsArray,...v:unknown[])=>(await c.query(s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,''),v)).rows;
 try{
  await admin.query(`create database ${database}`);await admin.query(`create role ${writer} login`);await admin.query(`create role ${reader} login`);
  const owner=await client();
  await owner.query(`create table tradeos_factor_evidence(id bigserial primary key,factor_key text,domain text,subject text,value double precision,source_name text,observed_at timestamptz,available_at timestamptz,source_metadata jsonb,
   unique(factor_key,domain,subject,source_name,observed_at,available_at));
   insert into tradeos_factor_evidence(factor_key,value,source_metadata) values('legacy_sentinel',123,'{"immutable_fixture":true}');`);
  const before=JSON.stringify((await owner.query('select * from tradeos_factor_evidence')).rows);
  for(const file of ['20261116_exact_factor_evidence.sql','20261116_daily_factor_claims.sql'])await owner.query(readFileSync('db/migrations/'+file,'utf8'));
  assert.equal(JSON.stringify((await owner.query('select * from tradeos_factor_evidence')).rows),before);checks.push('additive migrations preserve legacy sentinel');
  await owner.query(`grant usage on schema public to ${writer},${reader};grant select,insert on all tables in schema public to ${writer};grant usage,select on all sequences in schema public to ${writer};grant select on all tables in schema public to ${reader}`);
  const a=await client(writer),b=await client(writer),r=await client(reader);
  await assertDataStorageReady(sql(a),'exact');await assertDataStorageReady(sql(a),'daily');
  await assert.rejects(assertDataStorageReady(sql(r),'exact'),/not_ready/);checks.push('activation interlocks accept writer grants and reject read-only grants');
  const now=new Date(),stamp=now.toISOString().replace(/\.\d{3}Z$/,'.000000001Z'),later=stamp.replace('001Z','002Z');
  const evidence={factor:'slippage_estimate',domain:'stock' as const,subject:'SPY',source:'Alpaca:iex',value:1.25,observedAt:stamp,availableAt:later,metadata:{method:'local_fixture'}};
  const duplicates=await Promise.all([persistExactEvidenceWithSql(sql(a),[evidence],now),persistExactEvidenceWithSql(sql(b),[evidence],now)]);
  assert.equal(duplicates.reduce((n,x)=>n+x.saved,0),1);assert.equal(duplicates.reduce((n,x)=>n+x.accepted,0),2);checks.push('independent concurrent connections deduplicate exact writes');
  const conflicts=await Promise.all([persistExactEvidenceWithSql(sql(a),[{...evidence,subject:'CONFLICT',value:1}],now),persistExactEvidenceWithSql(sql(b),[{...evidence,subject:'CONFLICT',value:2}],now)]);
  assert.equal(conflicts.reduce((n,x)=>n+x.saved,0),1);assert.equal(conflicts.reduce((n,x)=>n+x.rejected.length,0),1);checks.push('concurrent conflicting identity rejected');
  assert.equal((await readExactEvidenceAtDecisionWithSql(sql(r),'SPY',stamp)).length,0);
  assert.equal((await readExactEvidenceAtDecisionWithSql(sql(r),'SPY',later))[0].observedAt,stamp);
  const coverage=await readSlippageCoverage(sql(r),later);assert.equal(coverage.count,2);assert.equal(coverage.latest.available_at,later);checks.push('read-only role preserves nanoseconds and exact cutoffs');
  await owner.query(`insert into tradeos_factor_evidence(factor_key,value,domain,subject,source_name,observed_at,available_at,source_metadata)
   values('slippage_estimate',99,'stock','CUTOFF','Alpaca:iex',$1,$2,'{}')`,[stamp.replace('000000001Z','000000000Z'),stamp.replace('000000001Z','000001000Z')]);
  assert.equal(await readSlippageAtDecisionWithSql(sql(r),'CUTOFF',stamp.replace('000000001Z','000000999Z')),null);
  assert.equal((await readSlippageAtDecisionWithSql(sql(r),'CUTOFF',stamp.replace('000000001Z','000001000Z')))?.value,99);
  checks.push('combined reader excludes a legacy microsecond beyond a nanosecond cutoff');
  await assert.rejects(persistExactEvidenceWithSql(sql(r),[{...evidence,subject:'DENIED'}],now),/permission denied/);
  await assert.rejects(a.query('update tradeos_factor_evidence_exact set value=8'),/permission denied/);
  for(const table of ['tradeos_factor_evidence_exact','tradeos_daily_factor_claims','tradeos_daily_factor_completions']){
   await assert.rejects(owner.query(`delete from ${table}`),/append-only/);await assert.rejects(owner.query(`truncate ${table} cascade`),/append-only/);
  }checks.push('least-privilege roles and owner-level append-only triggers');
  const start=new Date(),plan=dailyCollectionPlan(start),sa=dailyFactorStore(sql(a),()=>new Date()),sb=dailyFactorStore(sql(b),()=>new Date());
  const claims=await Promise.all([sa.claim(plan),sb.claim(plan)]);assert.equal(claims.filter(Boolean).length,1);checks.push('concurrent session claims have one winner');
  const bars:import('../lib/research/market-factor-engine').PriceBar[]=[];
  for(let day='2026-01-02';day<=plan.session;day=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10))if(isPinnedSession(day)){
   const value:number=100+bars.length*.1;
   bars.push({timestamp:day+(pinnedSessionClose(day).includes('T20:')?'T04:00:00Z':'T05:00:00Z'),open:value,high:value+1,low:value-1,close:value,volume:1000+bars.length});
  }
  let result:any;
  await runDailyFactorCollection({clock:()=>start,claim:async()=>true,history:async()=>({bars,source:'Alpaca:iex'}),finish:async(_p,x)=>{result=x;return 0;}});
  const winner=claims[0]?sa:sb;
  await owner.query("alter table tradeos_factor_evidence add constraint fixture_reject_completion check(factor_key='legacy_sentinel' or subject='CUTOFF')");
  await assert.rejects(winner.finish(plan,result),/check constraint/);
  assert.equal(Number((await owner.query('select count(*) from tradeos_factor_evidence')).rows[0].count),2);
  assert.equal(Number((await owner.query('select count(*) from tradeos_daily_factor_completions')).rows[0].count),0);
  assert.equal(Number((await owner.query('select count(*) from tradeos_daily_factor_claims')).rows[0].count),1);
  await owner.query('alter table tradeos_factor_evidence drop constraint fixture_reject_completion');
  checks.push('failed finalization rolls back all new rows and preserves consumed claim');
  // Distinct clients execute the same atomic finalization concurrently using the same claimed session.
  const captured:any[]=[];
  const capture=async(s:TemplateStringsArray,...v:unknown[])=>{captured.push([s,v]);return [{saved:72}];};
  const replayStore=dailyFactorStore(capture,()=>start);await replayStore.claim(plan);await replayStore.finish(plan,result);
  const [s,v]=captured.at(-1);const statement=s.reduce((q:string,p:string,i:number)=>q+(i?'$'+i:'')+p,'');
  const completions=await Promise.allSettled([a.query(statement,v),b.query(statement,v)]);
  assert.equal(completions.filter(x=>x.status==='fulfilled'&&x.value.rows.length===1).length,1);
  assert.equal(Number((await r.query('select count(*) from tradeos_factor_evidence where subject in (\'NVDA\',\'AMD\',\'PLTR\')')).rows[0].count),72);
  assert.equal(Number((await r.query('select count(*) from tradeos_daily_factor_completions')).rows[0].count),1);
  await assert.rejects(winner.finish(plan,result),/already_finished/);checks.push('concurrent atomic completion writes exactly 72 rows once');
  assert.equal(JSON.stringify((await owner.query("select * from tradeos_factor_evidence where factor_key='legacy_sentinel'")).rows),before);
  console.log(JSON.stringify({server:(await owner.query('select version()')).rows[0].version,isolatedDatabase:database,checks,passed:checks.length,productionAccess:false},null,2));
 }finally{
  await Promise.all(clients.map(c=>c.end()));
  await admin.query(`drop database if exists ${database}`);await admin.query(`drop role if exists ${writer}`);await admin.query(`drop role if exists ${reader}`);await admin.end();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
