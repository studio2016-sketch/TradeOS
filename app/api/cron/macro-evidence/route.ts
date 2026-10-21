import {NextResponse} from "next/server";
import {validateEvidence} from "../../../../lib/research/evidence-gate";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase,db} from "../../../../lib/db";
import {observedMacroEvidence} from "../../../../lib/research/official-macro-evidence";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_not_configured"},{status:503});
 try{
  const data=await observedMacroEvidence();
  const sql=db();
  let saved=0;
  for(const item of data.factors){
   const gate=validateEvidence(item);if(!gate.accepted)continue;
   const rows=await sql`insert into tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata) values(${item.factor},${item.domain},${item.subject},${item.value},${item.source},${item.observedAt},${item.availableAt},${JSON.stringify({retrievedAt:data.retrievedAt,backtestEligible:false})}::jsonb) on conflict do nothing returning id`;
   saved+=rows.length;
  }
  return NextResponse.json({status:"stored_research_evidence",received:data.factors.length,saved,retrievedAt:data.retrievedAt,excluded:data.excluded,ordersAllowed:false});
 }catch(e){return NextResponse.json({status:"official_macro_ingestion_failed",error:e instanceof Error?e.message:"Unknown"},{status:503});}
}
