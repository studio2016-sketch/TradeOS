import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {observedMacroEvidence} from "../../../../lib/research/official-macro-evidence";
import {observedTreasuryIssuanceEvidence} from "../../../../lib/research/treasury-issuance-evidence";
import {persistEvidence} from "../../../../lib/research/persist-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=120;
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_not_configured"},{status:503});
 try{
  const [data,treasury]=await Promise.all([observedMacroEvidence(),observedTreasuryIssuanceEvidence()]);
  const candidates=[
   ...data.factors.map(item=>({...item,metadata:{retrievedAt:data.retrievedAt,backtestEligible:false}})),
   ...treasury.candidates
  ];
  const persisted=await persistEvidence(candidates);
  await recordCollectorReceipt({
   collector:"fred_macro",status:"finished",received:persisted.received,saved:persisted.saved,
   details:{accepted:persisted.accepted,rejected:persisted.rejected,excluded:data.excluded,fredRetrievedAt:data.retrievedAt,treasuryRetrievedAt:treasury.retrievedAt,treasuryRows:treasury.rows}
  });
  return NextResponse.json({
   status:"stored_research_evidence",received:persisted.received,accepted:persisted.accepted,saved:persisted.saved,
   rejected:persisted.rejected,retrievedAt:data.retrievedAt,excluded:data.excluded,treasury:{rows:treasury.rows,measured:treasury.measured},ordersAllowed:false
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"fred_macro",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}
  catch(receiptError){console.error("fred_macro_receipt_write_failed",failureDetail(receiptError));}
  return NextResponse.json({status:"official_macro_ingestion_failed",error:failureDetail(e),ordersAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
