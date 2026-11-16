import {validateEvidence} from './evidence-gate';
import {evidenceTimestamp} from './evidence-time';
import type {PersistableEvidence} from './persist-evidence';

export const EXACT_EVIDENCE_POLICY='tradeos.evidence-persistence.nanoseconds.v1';
/** Explicit opt-in storage lane. No default connection, migration or production caller. */
export async function persistExactEvidenceWithSql(sql:any,candidates:PersistableEvidence[],now:Date){
 let accepted=0,saved=0;const rejected:{factor:string;reasons:string[]}[]=[];
 for(const e of candidates){
  const gate=validateEvidence(e,now);
  if(!gate.accepted){rejected.push({factor:typeof e?.factor==='string'?e.factor:'unknown',reasons:gate.reasons});continue;}
  const observed=evidenceTimestamp(e.observedAt)!.toString(),available=evidenceTimestamp(e.availableAt)!.toString();
  const metadata=JSON.stringify({...e.metadata,evidenceIntake:{policyVersion:gate.policyVersion,
   persistenceTimePolicy:EXACT_EVIDENCE_POLICY,observedAt:e.observedAt,availableAt:e.availableAt}});
  const rows=await sql`insert into tradeos_factor_evidence_exact
   (factor_key,domain,subject,value,source_name,observed_at_text,available_at_text,observed_ns,available_ns,source_metadata)
   values(${e.factor},${e.domain},${e.subject},${e.value},${e.source},${e.observedAt},${e.availableAt},${observed}::numeric,${available}::numeric,${metadata}::jsonb)
   on conflict do nothing returning id`;
  if(!rows.length){
   // Separate statement sees a concurrent committed winner after ON CONFLICT waited.
   // Never overwrite a conflicting immutable observation or call it a harmless retry.
   const same=await sql`select id from tradeos_factor_evidence_exact where factor_key=${e.factor} and domain=${e.domain}
    and subject=${e.subject} and source_name=${e.source} and observed_ns=${observed}::numeric and available_ns=${available}::numeric
    and value=${e.value} and source_metadata=${metadata}::jsonb`;
   if(same.length!==1){rejected.push({factor:e.factor,reasons:['conflicting_exact_evidence_identity']});continue;}
  }
  accepted++;saved+=rows.length;
 }
 return {received:candidates.length,accepted,saved,rejected};
}
/** Reads ONLY the exact lane, explicitly scoped by subject; never implies legacy coverage. */
export async function readExactEvidenceAtDecisionWithSql(sql:any,subject:string,decisionTime:string,limit=1000):Promise<PersistableEvidence[]>{
 const cutoff=evidenceTimestamp(decisionTime);
 if(cutoff===null||typeof subject!=='string'||!subject.trim()||!Number.isInteger(limit)||limit<1||limit>10000)throw Error('invalid_exact_evidence_query');
 const rows=await sql`select factor_key as factor,domain,subject,value,source_name as source,
  observed_at_text as "observedAt",available_at_text as "availableAt",observed_ns::text as observed_ns,
  available_ns::text as available_ns,source_metadata as metadata from tradeos_factor_evidence_exact
  where subject=${subject} and available_ns<=${cutoff.toString()}::numeric order by available_ns desc,id desc limit ${limit+1}`;
 if(rows.length>limit)throw Error('exact_evidence_result_incomplete');
 for(const row of rows){
  const o=evidenceTimestamp(row.observedAt),a=evidenceTimestamp(row.availableAt);
  if(o===null||a===null||o>a||a>cutoff||o.toString()!==row.observed_ns||a.toString()!==row.available_ns)throw Error('corrupt_exact_evidence_chronology');
 }
 return rows.map(({observed_ns,available_ns,...row}:any)=>row as PersistableEvidence);
}
