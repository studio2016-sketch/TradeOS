import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
import {observedMarketwideEventEvidenceWithSql} from '../lib/research/marketwide-event-evidence';
import {auditEvidence} from '../lib/research/source-vintage-audit';
import {evidenceTimestamp} from '../lib/research/evidence-time';

test('embedded PostgreSQL roundtrip preserves supported instants and rejects unsafe evidence',async(t)=>{
 const pg=new PGlite();
 try{
  // Representative persistence contract, not a claim that production schema/transport was inspected.
  await pg.exec(`create table tradeos_factor_evidence (
   id bigserial primary key,factor_key text not null,domain text not null,subject text not null,
   value double precision not null,source_name text not null,observed_at timestamptz not null,
   available_at timestamptz not null,source_metadata jsonb not null,
   check(observed_at<=available_at),check(source_name<>'SQL_REJECT'),
   unique(factor_key,domain,subject,source_name,observed_at,available_at)
  ); create table source_observations(id bigserial primary key);`);
  const schema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
  const guard=schema.match(/create or replace function tradeos_reject_decision_mutation\(\)[\s\S]*?\$\$;/)?.[0];
  assert.ok(guard);await pg.exec(guard);
  await pg.exec(readFileSync(new URL('../db/migrations/20261021_phase4_append_only_evidence.sql',import.meta.url),'utf8'));
  let insertCalls=0;
  const sql=async(strings:TemplateStringsArray,...values:unknown[])=>{
   const query=strings.reduce((s,part,i)=>s+(i?`$${i}`:'')+part,'');
   if(/insert into tradeos_factor_evidence/.test(query))insertCalls++;
   return(await pg.query(query,values)).rows;
  };
  const now=new Date('2030-02-01T12:00:00Z');
  const e={factor:'eps_surprise',value:1,domain:'news' as const,source:'Synthetic publisher',subject:'TEST',observedAt:'2030-02-01T11:59:00.123456000Z',availableAt:now.toISOString(),metadata:{parserVersion:'synthetic'}};

  await t.test('engine demonstrates the submicrosecond tie that the persistence gate prevents',async()=>{
   const {rows}=await pg.query<{same:boolean}>(`select '2030-02-01T12:00:00.000000001Z'::timestamptz='2030-02-01T12:00:00Z'::timestamptz as same`);
   assert.equal(rows[0].same,true);
   const before=insertCalls;
   const r=await persistEvidenceWithSql(sql,[{...e,availableAt:'2030-02-01T12:00:00.000000001Z'}],now);
   assert.deepEqual(r.rejected[0].reasons,['unsupported_storage_precision']);assert.equal(insertCalls,before);
  });
  await t.test('insert and text readback preserve microseconds and provenance; duplicate insert is a no-op',async()=>{
   assert.equal((await persistEvidenceWithSql(sql,[e],now)).saved,1);
   assert.equal((await persistEvidenceWithSql(sql,[e],now)).saved,0);
   const {rows}=await pg.query<{observed:string;available:string;source_metadata:Record<string,any>}>(`select observed_at::text as observed,available_at::text as available,source_metadata from tradeos_factor_evidence`);
   assert.equal(rows.length,1);assert.equal(evidenceTimestamp(rows[0].observed),evidenceTimestamp(e.observedAt));
   assert.equal(evidenceTimestamp(rows[0].available),evidenceTimestamp(e.availableAt));
   assert.equal(rows[0].source_metadata.evidenceIntake.observedAt,e.observedAt);
  });
  await t.test('SQL decision cutoff excludes a receipt one microsecond later and exact audit selects the later row',async()=>{
   const older={...e,value:2,availableAt:'2030-02-01T12:00:00.000001Z'},later={...e,value:3,availableAt:'2030-02-01T12:00:00.000002Z'};
   assert.equal((await persistEvidenceWithSql(sql,[older,later],now)).saved,2);
   const {rows}=await pg.query<{value:number}>(`select value from tradeos_factor_evidence where available_at<=$1::timestamptz order by available_at desc limit 1`,[now.toISOString()]);
   assert.equal(rows[0].value,1);
   const readback=await pg.query<any>(`select factor_key as factor,value,domain,source_name as source,subject,observed_at::text as "observedAt",available_at::text as "availableAt" from tradeos_factor_evidence order by available_at desc`);
   assert.equal(auditEvidence(readback.rows,'2030-02-01T12:00:01Z').evidence[0].value,3);
   assert.equal(auditEvidence(readback.rows,now.toISOString()).evidence[0].value,1);
  });
  await t.test('engine constraints reject invalid writes; batch SQL errors propagate without rewriting prior rows',async()=>{
   await assert.rejects(pg.query(`insert into tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata) values('eps_surprise','news','RAW',1,'synthetic','2030-02-01T12:00:01Z','2030-02-01T12:00:00Z','{}')`),/check constraint/);
   await assert.rejects(persistEvidenceWithSql(sql,[{...e,subject:'PARTIAL'},{...e,source:'SQL_REJECT'}],now),/check constraint/);
   const {rows}=await pg.query<{count:number}>(`select count(*)::int as count from tradeos_factor_evidence where subject='PARTIAL'`);
   assert.equal(rows[0].count,1);
   await assert.rejects(pg.query(`update tradeos_factor_evidence set value=99`),/append-only/);
   await assert.rejects(pg.query(`delete from tradeos_factor_evidence`),/append-only/);
  });
  await t.test('actual cache SELECT, parser and insert path retain a PostgreSQL publication timestamp',async()=>{
   await pg.exec(readFileSync(new URL('../db/migrations/20261021_news_article_cache.sql',import.meta.url),'utf8'));
   await pg.query(`insert into tradeos_news_articles(provider,article_id,published_at,headline,symbols,source_name,source_quality) values('synthetic','pg:1',$1,'EPS $2 beats $1 estimate','["PGTEST"]','Synthetic publisher',1)`,['2030-02-01T11:59:00.654321Z']);
   const result=await observedMarketwideEventEvidenceWithSql(sql,()=>now);
   assert.equal(result.candidates.length,1);
   assert.equal(evidenceTimestamp(result.candidates[0].observedAt),evidenceTimestamp('2030-02-01T11:59:00.654321Z'));
   assert.equal((await persistEvidenceWithSql(sql,result.candidates,now)).saved,1);
  });
 }finally{await pg.close();}
});
