import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {observedNetworkAndCrossAssetEvidence} from "../../../../lib/research/network-crossasset-evidence";
import {persistEvidence} from "../../../../lib/research/persist-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=120;
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 try{
  const data=await observedNetworkAndCrossAssetEvidence();
  const persisted=await persistEvidence(data.candidates);
  await recordCollectorReceipt({collector:"network_crossasset",status:"finished",received:data.candidates.length,saved:persisted.saved,details:{accepted:persisted.accepted,rejected:persisted.rejected,diagnostics:data.diagnostics,retrievedAt:data.retrievedAt}});
  return NextResponse.json({status:"stored_network_crossasset_evidence",received:data.candidates.length,accepted:persisted.accepted,saved:persisted.saved,rejected:persisted.rejected,diagnostics:data.diagnostics,ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"network_crossasset",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch{}
  return NextResponse.json({status:"network_crossasset_failed",error:failureDetail(e),ordersAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
