import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {observedPortfolioFactorEvidence} from "../../../../lib/research/portfolio-factor-evidence";
import {persistEvidence} from "../../../../lib/research/persist-evidence";
import {failureDetail,recordCollectorReceipt} from "../../../../lib/research/collector-receipts";

export const dynamic="force-dynamic";export const maxDuration=180;
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 try{
  const result=await observedPortfolioFactorEvidence(),persisted=await persistEvidence(result.candidates);
  await recordCollectorReceipt({collector:"portfolio_factors",status:"finished",received:result.candidates.length,saved:persisted.saved,details:{status:result.status,diagnostics:result.diagnostics}});
  return NextResponse.json({status:result.status,received:persisted.received,accepted:persisted.accepted,saved:persisted.saved,rejected:persisted.rejected,certified:false,approvedForTrading:false},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  try{await recordCollectorReceipt({collector:"portfolio_factors",status:"failed",received:0,saved:0,details:{error:failureDetail(error)}});}catch{}
  return NextResponse.json({status:"portfolio_factor_evidence_failed",error:failureDetail(error),certified:false},{status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
