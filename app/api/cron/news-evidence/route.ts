import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {observedNewsFactors} from "../../../../lib/research/news-factor-evidence";
import {persistEvidence} from "../../../../lib/research/persist-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=90;

export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const symbols=(process.env.TRADEOS_WATCHLIST||"NVDA,AMD,PLTR,SPY,QQQ,IWM").split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
 try{
  const data=await observedNewsFactors(symbols);
  const persisted=await persistEvidence(data.candidates);
  await recordCollectorReceipt({
   collector:"news_factors",status:"finished",received:data.newsCount,saved:persisted.saved,
   details:{symbols:data.symbols,candidates:data.candidates.length,accepted:persisted.accepted,rejected:persisted.rejected,providerErrors:data.errors,retrievedAt:data.retrievedAt}
  });
  return NextResponse.json({status:"stored_news_factor_evidence",newsCount:data.newsCount,candidates:data.candidates.length,accepted:persisted.accepted,saved:persisted.saved,errors:data.errors,ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"news_factors",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch{}
  return NextResponse.json({status:"news_factor_evidence_failed",error:failureDetail(e),ordersAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
