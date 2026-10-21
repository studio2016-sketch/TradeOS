import {db} from "../db";
import {validateEvidence,type EvidenceCandidate} from "./evidence-gate";

export type PersistableEvidence=EvidenceCandidate&{metadata?:Record<string,unknown>};

export async function persistEvidence(candidates:PersistableEvidence[]){
 const sql=db();
 let accepted=0,saved=0;
 const rejected:{factor:string;reasons:string[]}[]=[];
 for(const item of candidates){
  const gate=validateEvidence(item);
  if(!gate.accepted){rejected.push({factor:item.factor,reasons:gate.reasons});continue;}
  accepted++;
  const rows=await sql`insert into tradeos_factor_evidence(
   factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata
  ) values(
   ${item.factor},${item.domain},${item.subject},${item.value},${item.source},
   ${item.observedAt},${item.availableAt},${JSON.stringify(item.metadata??{})}::jsonb
  ) on conflict do nothing returning id`;
  saved+=rows.length;
 }
 return {received:candidates.length,accepted,saved,rejected};
}
