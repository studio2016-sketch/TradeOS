import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {accelerationTick} from "../../../../lib/research/acceleration-collector";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_not_configured"},{status:503});
 try{
  const result=await accelerationTick();
  await recordCollectorReceipt({collector:"acceleration",status:"finished",received:result.snapshotCount??0,saved:result.saved??0,details:{timestamp:result.timestamp,selected:result.selected,historyBars:result.historyBars,historyFailures:result.historyFailures,newsErrors:result.newsErrors}});
  return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  try{await recordCollectorReceipt({collector:"acceleration",status:"failed",received:0,saved:0,details:{error:failureDetail(error)}});}catch(receiptError){console.error("acceleration_receipt_write_failed",failureDetail(receiptError));}
  return NextResponse.json({status:"collection_failed",reason:error instanceof Error?error.message:"Unknown",executionAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
