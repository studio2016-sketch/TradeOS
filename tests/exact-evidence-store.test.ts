import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {persistExactEvidenceWithSql as persist,readExactEvidenceAtDecisionWithSql as read} from '../lib/research/exact-evidence-store';
import {evidenceTimestamp} from '../lib/research/evidence-time';
import {auditEvidence} from '../lib/research/source-vintage-audit';
const now=new Date('2026-11-16T22:00:01Z');
const base={factor:'slippage_estimate',domain:'stock' as const,subject:'SPY',source:'Alpaca:iex',value:1.23456789,
 observedAt:'2026-11-16T22:00:00.123456789Z',availableAt:'2026-11-16T22:00:00.123456790Z',metadata:{method:'fixture'}};
async function fixture(){
 const pg=new PGlite();await pg.exec(readFileSync(new URL('../db/migrations/20261116_exact_factor_evidence.sql',import.meta.url),'utf8'));
 const sql=async(s:TemplateStringsArray,...v:unknown[])=>(await pg.query(s.reduce((q,p,i)=>q+(i?'$'+i:'')+p,''),v)).rows;
 return {pg,sql};
}
test('exact SQL roundtrip separates adjacent nanoseconds and preserves original value/text',async()=>{
 const {pg,sql}=await fixture();try{
  const later={...base,value:2,availableAt:'2026-11-16T22:00:00.123456791Z'};
  assert.equal((await persist(sql,[base,later],now)).saved,2);
  assert.equal((await read(sql,'SPY',base.observedAt)).length,0);
  const first=await read(sql,'SPY',base.availableAt);assert.equal(first.length,1);assert.equal(first[0].value,base.value);assert.equal(first[0].observedAt,base.observedAt);
  const all=await read(sql,'SPY',later.availableAt);assert.equal(all.length,2);
  assert.equal(auditEvidence(all,base.availableAt).evidence[0].value,base.value);
  assert.equal(auditEvidence(all,later.availableAt).evidence[0].value,2);
  await assert.rejects(read(sql,'SPY',later.availableAt,1),/incomplete/);
  assert.deepEqual(await read(sql,'QQQ',later.availableAt),[]);
 }finally{await pg.close();}
});
test('SQL parser agrees with integer-nanosecond parser across offsets, boundaries and invalid dates',async()=>{
 const {pg}=await fixture();try{
  for(const stamp of ['1000-01-01T00:00:00.000000001Z','9999-12-31T23:59:59.999999999Z','1969-12-31T23:59:59.999999999Z',
   '2026-11-16T22:00:00.123456789Z','2026-11-16 17:00:00.123456789-05','2026-11-16T23:00:00.123456789+0100',
   '2026-02-30T00:00:00Z','2026-11-16T24:00:00Z','2026-11-16T23:60:00Z','2026-11-16T23:00:60Z','2026-11-16T00:00:00+24:00','2026-11-16']){
   const r=await pg.query<{ns:string|null}>('select tradeos_evidence_epoch_ns($1)::text ns',[stamp]);
   assert.equal(r.rows[0].ns,evidenceTimestamp(stamp)?.toString()??null,stamp);
  }
 }finally{await pg.close();}
});
test('duplicate retries are no-ops; conflicting values and metadata never overwrite evidence',async()=>{
 const {pg,sql}=await fixture();try{
  assert.equal((await persist(sql,[base],now)).saved,1);
  assert.deepEqual(await persist(sql,[base],now),{received:1,accepted:1,saved:0,rejected:[]});
  for(const change of [{value:99},{metadata:{method:'different'}}]){
   const result=await persist(sql,[{...base,...change}],now);assert.equal(result.saved,0);assert.equal(result.rejected[0].reasons[0],'conflicting_exact_evidence_identity');
  }
  assert.equal((await read(sql,'SPY',now.toISOString()))[0].value,base.value);
  for(const command of ['update tradeos_factor_evidence_exact set value=99','delete from tradeos_factor_evidence_exact','truncate tradeos_factor_evidence_exact'])await assert.rejects(pg.exec(command),/append-only/);
 }finally{await pg.close();}
});
test('invalid chronology and nonfinite values fail before SQL; DB blocks mismatched exact text',async()=>{
 const {pg,sql}=await fixture();try{
  let calls=0;
  const result=await persist(async()=>{calls++;throw Error('must not insert');},[
   {...base,value:NaN},{...base,availableAt:base.observedAt.replace('789','788')},{...base,observedAt:'2026-02-30T00:00:00Z'}],now);
  assert.equal(calls,0);assert.equal(result.rejected.length,3);
  await assert.rejects(sql`insert into tradeos_factor_evidence_exact(factor_key,domain,subject,value,source_name,observed_at_text,available_at_text,observed_ns,available_ns,source_metadata)
   values('slippage_estimate','stock','SPY',1,'fixture',${base.observedAt},${base.availableAt},1,2,'{}')`,/check constraint/);
  const good=await persist(sql,[base],now);assert.equal(good.saved,1);
  const legacy=await pg.query<{exists:boolean}>("select to_regclass('tradeos_factor_evidence') is not null as exists");assert.equal(legacy.rows[0].exists,false);
 }finally{await pg.close();}
});

import {persistIntradayWithExactSlippage} from '../lib/research/intraday-exact-persistence';
test('prepared intraday boundary saves nanosecond slippage exactly while retaining the legacy factor lane',async()=>{
 const {pg,sql}=await fixture();try{
  await pg.exec(`create table tradeos_factor_evidence(id serial primary key,factor_key text,domain text,subject text,value double precision,source_name text,observed_at timestamptz,available_at timestamptz,source_metadata jsonb);`);
  const other={...base,factor:'trade_count',value:10,observedAt:'2026-11-16T22:00:00Z',availableAt:'2026-11-16T22:00:01Z'};
  const result=await persistIntradayWithExactSlippage(sql,[base,other],now);
  assert.equal(result.saved,2);assert.deepEqual(result.rejected,[]);assert.deepEqual(result.storageLanes,{legacy:1,exactSlippage:1});
  assert.equal((await pg.query<any>('select factor_key from tradeos_factor_evidence')).rows[0].factor_key,'trade_count');
  assert.equal((await read(sql,'SPY',now.toISOString()))[0].observedAt,base.observedAt);
 }finally{await pg.close();}
});
