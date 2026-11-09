import {db} from "../db";
import {validateEvidence,type EvidenceCandidate} from "./evidence-gate";
import {evidenceTimestamp} from './evidence-time';

export type PersistableEvidence=EvidenceCandidate&{metadata?:Record<string,unknown>};
export const EVIDENCE_PERSISTENCE_TIME_POLICY='tradeos.evidence-persistence.microseconds.v1';

export async function persistEvidence(candidates:PersistableEvidence[]){
 return persistEvidenceWithSql(db(),candidates);
}

/** Injectable storage boundary for deterministic tests; actual callers still use db(). */
export async function persistEvidenceWithSql(sql:any,candidates:PersistableEvidence[],now?:Date){
 let accepted=0,saved=0;
 const rejected:{factor:string;reasons:string[]}[]=[];
 for(const item of candidates){
  const gate=validateEvidence(item,now);
  if(!gate.accepted){rejected.push({factor:typeof item?.factor==="string"?item.factor:"unknown",reasons:gate.reasons});continue;}
  // General evidence parsing permits offsets that PostgreSQL cannot store.
  // Reject them individually before INSERT instead of aborting the remaining batch.
  if([item.observedAt,item.availableAt].some(t=>Number(t.match(/[+-](\d{2})(?::?\d{2})?$/)?.[1]??0)>=16)){
   rejected.push({factor:item.factor,reasons:['unsupported_storage_timezone_offset']});continue;
  }
  // PostgreSQL timestamptz cannot preserve nonzero submicrosecond digits.
  // Do not let rounding turn a later receipt into an eligible decision-time tie.
  if([item.observedAt,item.availableAt].some(t=>evidenceTimestamp(t)! % BigInt(1000) !== BigInt(0))){
   rejected.push({factor:item.factor,reasons:['unsupported_storage_precision']});continue;
  }
  const metadata={...item.metadata,evidenceIntake:{policyVersion:gate.policyVersion,persistenceTimePolicy:EVIDENCE_PERSISTENCE_TIME_POLICY,observedAt:item.observedAt,availableAt:item.availableAt}};
  accepted++;
  const rows=await sql`insert into tradeos_factor_evidence(
   factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata
  ) values(
   ${item.factor},${item.domain},${item.subject},${item.value},${item.source},
   ${item.observedAt},${item.availableAt},${JSON.stringify(metadata)}::jsonb
  ) on conflict do nothing returning id`;
  saved+=rows.length;
 }
 return {received:candidates.length,accepted,saved,rejected};
}
