import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {persistEvidenceWithSql,type PersistableEvidence} from '../lib/research/persist-evidence';
import {validateEvidence} from '../lib/research/evidence-gate';
import {evidenceTimestamp} from '../lib/research/evidence-time';

const now=new Date('2030-02-02T12:00:00Z');
function candidate(offset:string,field:'observedAt'|'availableAt'):PersistableEvidence {
 const raw='2030-02-01T12:00:00'+offset;
 const utc=new Date(Number(evidenceTimestamp(raw)!/BigInt(1000000))).toISOString();
 return {factor:'eps_surprise',value:1,domain:'news',source:'Synthetic publisher',subject:'TEST',observedAt:utc,availableAt:utc,[field]:raw};
}
const unsupported=['+16','-16','+1600','-1600','+16:00','-16:00','+23:59','-23:59'];

test('PostgreSQL timezone displacement boundary is below sixteen hours in either direction',async()=>{
 const pg=new PGlite();
 try{
  for(const offset of ['+15:59','-15:59']){
   const raw='2030-02-01T12:00:00'+offset;
   const result=await pg.query<{stamp:string}>('select $1::timestamptz::text as stamp',[raw]);
   assert.equal(evidenceTimestamp(result.rows[0].stamp),evidenceTimestamp(raw));
  }
  for(const offset of unsupported)await assert.rejects(pg.query('select $1::timestamptz',['2030-02-01T12:00:00'+offset]),(error:unknown)=>(error as {code?:string}).code==='22009');
 }finally{await pg.close();}
});

test('unsupported storage offsets are rejected before INSERT without changing general timestamp parsing',async()=>{
 for(const offset of unsupported)for(const field of ['observedAt','availableAt'] as const){
  const e=candidate(offset,field);
  assert.equal(validateEvidence(e,now).accepted,true);
  const result=await persistEvidenceWithSql(async()=>assert.fail('Unrepresentable timezone reached INSERT'),[e],now);
  assert.deepEqual(result,{received:1,accepted:0,saved:0,rejected:[{factor:'eps_surprise',reasons:['unsupported_storage_timezone_offset']}]});
 }
});

test('supported offset spellings retain exact timestamp provenance at the INSERT boundary',async()=>{
 for(const offset of ['+15:59','-15:59','+1559','-1559','+15','-15','Z'])for(const field of ['observedAt','availableAt'] as const){
  const e=candidate(offset,field);let calls=0;
  const result=await persistEvidenceWithSql(async(_s:TemplateStringsArray,...values:unknown[])=>{
   calls++;assert.equal(values[5],e.observedAt);assert.equal(values[6],e.availableAt);
   const metadata=JSON.parse(values[7] as string);
   assert.equal(metadata.evidenceIntake[field],e[field]);return[{id:'synthetic'}];
  },[e],now);
  assert.equal(calls,1);assert.equal(result.saved,1);assert.deepEqual(result.rejected,[]);
 }
});

test('invalid offset candidates cannot interrupt later valid evidence in a real embedded PostgreSQL batch',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create table tradeos_factor_evidence(id serial primary key,factor_key text,domain text,subject text,value double precision,source_name text,observed_at timestamptz,available_at timestamptz,source_metadata jsonb)`);
  let insertCalls=0;
  const sql=async(strings:TemplateStringsArray,...values:unknown[])=>{
   insertCalls++;return(await pg.query(strings.reduce((text,part,i)=>text+(i?`$${i}`:'')+part,''),values)).rows;
  };
  const good={...candidate('-15:59','availableAt'),subject:'VALID'};
  const result=await persistEvidenceWithSql(sql,[candidate('+16:00','observedAt'),candidate('-16:00','availableAt'),good],now);
  assert.equal(result.received,3);assert.equal(result.accepted,1);assert.equal(result.saved,1);assert.equal(result.rejected.length,2);assert.equal(insertCalls,1);
  const {rows}=await pg.query<{subject:string;observed:string;available:string}>('select subject,observed_at::text as observed,available_at::text as available from tradeos_factor_evidence');
  assert.equal(rows.length,1);assert.equal(rows[0].subject,'VALID');
  assert.equal(evidenceTimestamp(rows[0].observed),evidenceTimestamp(good.observedAt));assert.equal(evidenceTimestamp(rows[0].available),evidenceTimestamp(good.availableAt));
 }finally{await pg.close();}
});
