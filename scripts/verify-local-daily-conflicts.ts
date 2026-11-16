/** Fixed loopback-only regression. Never reads DATABASE_URL or production credentials. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {dailyFactorStore} from '../lib/research/daily-factor-store';
import {dailyCollectionPlan,pinnedSessionClose,runDailyFactorCollection} from '../lib/research/daily-factor-collection';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
async function main(){
 assert.equal(process.argv[2],'--disposable-local-pg-55439');
 const {default:pg}=await import(pathToFileURL(resolve('../tradeos-local-postgres/node_modules/pg/lib/index.js')).href);
 const connection={host:'127.0.0.1',port:55439,user:'agent',database:'postgres',connectionTimeoutMillis:3000};
 const admin=new pg.Client(connection);await admin.connect();
 assert.equal((await admin.query('show data_directory')).rows[0].data_directory,resolve('../tradeos-local-postgres/cluster'));
 const checks:string[]=[];
 try{
  for(const scenario of ['reproduce_old','value_conflict','provenance_conflict','identical_replay']){
   const name='daily_conflict_'+scenario+'_'+Date.now();await admin.query(`create database ${name}`);
   const c=new pg.Client({...connection,database:name});await c.connect();
   try{
    await c.query(`create table tradeos_factor_evidence(id bigserial primary key,factor_key text,domain text,subject text,value double precision,source_name text,observed_at timestamptz,available_at timestamptz,source_metadata jsonb,
     unique(factor_key,domain,subject,source_name,observed_at,available_at));`);
    await c.query(readFileSync('db/migrations/20261116_daily_factor_claims.sql','utf8'));
    const sql=async(s:TemplateStringsArray,...v:unknown[])=>{
     let query=s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,'');
     // Synthetic reproduction of the prior defect: omit only the new atomic assertion.
     if(scenario==='reproduce_old')query=query.replace(/where tradeos_assert_daily_completion\([\s\S]*?\)\s*returning saved/,'where $'+v.length+'::timestamptz is not null returning saved');
     return (await c.query(query,v)).rows;
    };
    const now=new Date(),plan=dailyCollectionPlan(now),store=dailyFactorStore(sql,()=>new Date());let candidate:any;
    const timestamp=plan.session+(pinnedSessionClose(plan.session).includes('T20:')?'T04:00:00Z':'T05:00:00Z');
    await runDailyFactorCollection({clock:()=>now,claim:store.claim,history:async()=>({source:'Alpaca:iex',bars:[{timestamp,open:100,high:102,low:99,close:101,volume:1000}]}),finish:async(_p,r)=>{candidate=r;return 0;}});
    assert.equal(candidate.evidence.length,6);
    const first=candidate.evidence[0],existing=scenario==='identical_replay'?first:scenario==='provenance_conflict'?{...first,metadata:{...first.metadata,inputSha256:'conflicting'}}:{...first,value:99999};
    await persistEvidenceWithSql(sql,[existing],now);
    const before=JSON.stringify((await c.query('select * from tradeos_factor_evidence')).rows);
    if(scenario==='reproduce_old'||scenario==='identical_replay'){
     assert.equal(await store.finish(plan,candidate),5);
     assert.equal(Number((await c.query('select count(*) from tradeos_daily_factor_completions')).rows[0].count),1);
     assert.equal(Number((await c.query('select count(*) from tradeos_factor_evidence')).rows[0].count),6);
     if(scenario==='reproduce_old')assert.equal((await c.query('select value from tradeos_factor_evidence where id=1')).rows[0].value,99999);
    }else{
     await assert.rejects(store.finish(plan,candidate),/conflicting_or_unverified_daily_evidence_identity/);
     assert.equal(JSON.stringify((await c.query('select * from tradeos_factor_evidence')).rows),before);
     assert.equal(Number((await c.query('select count(*) from tradeos_daily_factor_completions')).rows[0].count),0);
     assert.equal(Number((await c.query('select count(*) from tradeos_daily_factor_claims')).rows[0].count),1);
     assert.equal(await dailyFactorStore(sql,()=>new Date()).claim(plan),false);
    }
    checks.push(scenario+': passed');
   }finally{await c.end();await admin.query(`drop database ${name}`);}
  }
  console.log(JSON.stringify({server:(await admin.query('select version()')).rows[0].version,checks,productionAccess:false},null,2));
 }finally{await admin.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
