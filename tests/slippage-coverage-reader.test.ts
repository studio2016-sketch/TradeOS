import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {readSlippageCoverage,mergeLatestSlippage,readSlippageAtDecisionWithSql} from '../lib/research/slippage-coverage-reader';
import {persistExactEvidenceWithSql} from '../lib/research/exact-evidence-store';
import {factorCoverageAuditWithSql} from '../lib/research/factor-coverage-audit';
const now=new Date('2026-11-16T22:00:01Z');
const e={factor:'slippage_estimate',value:1,domain:'stock' as const,subject:'SPY',source:'Alpaca:iex',observedAt:'2026-11-16T22:00:00.000000001Z',availableAt:'2026-11-16T22:00:00.000000002Z'};
async function fixture(){const pg=new PGlite();const sql=async(s:TemplateStringsArray,...v:unknown[])=>(await pg.query(s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,''),v)).rows;return {pg,sql};}
test('absent exact schema is explicit; permission or query failures never masquerade as no evidence',async()=>{
 const {pg,sql}=await fixture();try{
  assert.deepEqual(await readSlippageCoverage(sql,now.toISOString()),{storage:'not_migrated',count:0,latest:null,certified:false});
  await assert.rejects(readSlippageCoverage(async()=>{throw Error('permission denied');},now.toISOString()),/permission/);
  await assert.rejects(readSlippageCoverage(sql,'bad'),/window/);
 }finally{await pg.close();}
});
test('coverage respects nanosecond cutoffs and windows, preserves original clocks and excludes unrelated exact factors',async()=>{
 const {pg,sql}=await fixture();try{
  await pg.exec(readFileSync(new URL('../db/migrations/20261116_exact_factor_evidence.sql',import.meta.url),'utf8'));
  await persistExactEvidenceWithSql(sql,[e,{...e,value:2,availableAt:'2026-11-16T22:00:00.000000003Z'},{...e,factor:'trade_count'}],now);
  assert.equal((await readSlippageCoverage(sql,e.observedAt)).count,0);
  const at=await readSlippageCoverage(sql,e.availableAt);assert.equal(at.count,1);assert.equal(at.latest.available_at,e.availableAt);
  const next=await readSlippageCoverage(sql,'2026-11-16T22:00:00.000000003Z','2026-11-16T22:00:00.000000003Z');assert.equal(next.count,1);assert.equal(next.latest.value,2);
  const legacy={factor_key:'slippage_estimate',value:9,subject:'SPY',source_name:'Alpaca:iex',observed_at:'2026-11-16 22:00:00+00',available_at:'2026-11-16 22:00:00+00'};
  assert.equal(mergeLatestSlippage([legacy],at)[0].value,1);
  assert.throws(()=>mergeLatestSlippage([{...legacy,available_at:e.availableAt}],at),/conflicting/);
 }finally{await pg.close();}
});
test('historical exact coverage remains descriptive and cannot promote legacy phase or certification counts',async()=>{
 const {pg,sql}=await fixture();try{
  await pg.exec(readFileSync(new URL('../db/migrations/20261116_exact_factor_evidence.sql',import.meta.url),'utf8'));
  await pg.exec(`create table tradeos_factor_coverage_status(factor_key text,observation_count int,populated_count int,populated_pct float,last_populated_at timestamptz,implementation_status text,permission_status text);
   create table tradeos_factor_evidence(factor_key text,available_at timestamptz,source_metadata jsonb);
   create table tradeos_news_articles(article_id text,symbols jsonb);`);
  await persistExactEvidenceWithSql(sql,[e],now);
  const result=await factorCoverageAuditWithSql(sql,now.toISOString());
  assert.equal(result.measuredFactorCount,0);assert.equal(result.combinedDescriptiveMeasuredFactorCount,1);
  assert.equal(result.exactSlippageCoverage.exactRows,1);assert.equal(result.exactSlippageCoverage.latestAvailableAt,e.availableAt);
  assert.equal(result.exactSlippageCoverage.certified,false);assert.equal(result.missingMeasuredKeys.includes('slippage_estimate'),true);
 }finally{await pg.close();}
});

test('combined subject reader never rounds a nanosecond cutoff up to a later legacy receipt',async()=>{
 const {pg,sql}=await fixture();try{
  await pg.exec(readFileSync(new URL('../db/migrations/20261116_exact_factor_evidence.sql',import.meta.url),'utf8'));
  await pg.exec(`create table tradeos_factor_evidence(id serial primary key,factor_key text,value float8,domain text,source_name text,subject text,observed_at timestamptz,available_at timestamptz);
   insert into tradeos_factor_evidence(factor_key,value,domain,source_name,subject,observed_at,available_at)
   values('slippage_estimate',99,'stock','Alpaca:iex','SPY','2026-11-16T22:00:00Z','2026-11-16T22:00:00.000001Z');`);
  await persistExactEvidenceWithSql(sql,[e],now);
  assert.equal((await readSlippageAtDecisionWithSql(sql,'SPY','2026-11-16T22:00:00.000000999Z'))?.value,1);
  assert.equal((await readSlippageAtDecisionWithSql(sql,'SPY','2026-11-16T22:00:00.000001Z'))?.value,99);
  assert.equal(await readSlippageAtDecisionWithSql(sql,'QQQ',now.toISOString()),null);
 }finally{await pg.close();}
});
