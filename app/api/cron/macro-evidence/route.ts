import {NextResponse} from "next/server";
import {validateEvidence} from "../../../../lib/research/evidence-gate";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase,db} from "../../../../lib/db";
import {observedMacroEvidence} from "../../../../lib/research/official-macro-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
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
  await sql`insert into tradeos_collector_runs(collector,status,received,saved,details) values('fred_macro','finished',${data.factors.length},${saved},${JSON.stringify({excluded:data.excluded})}::jsonb)`;
  return NextResponse.json({status:"stored_research_evidence",received:data.factors.length,saved,retrievedAt:data.retrievedAt,excluded:data.excluded,ordersAllowed:false});
 }catch(e){try{await recordCollectorReceipt({collector:"fred_macro",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch(receiptError){console.error("fred_macro_receipt_write_failed",failureDetail(receiptError));}return NextResponse.json({status:"official_macro_ingestion_failed",error:failureDetail(e)},{status:503});}
}
