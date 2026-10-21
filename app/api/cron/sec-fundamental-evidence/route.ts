import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {secRatioEvidence} from "../../../../lib/research/sec-ratio-evidence";
import {persistEvidence} from "../../../../lib/research/persist-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=120;
const symbols=["AAPL","MSFT","NVDA","AMZN","META","GOOGL","AMD","TSLA","JPM","XOM"];
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const day=Math.floor(Date.now()/86400000)%5;
 const selected=symbols.slice(day*2,day*2+2);
 const results:{symbol:string;status:string;saved?:number;accepted?:number;received?:number;reason?:string}[]=[];
 try{
  for(const symbol of selected){
   try{
    const evidence=await secRatioEvidence(symbol);
    const persisted=await persistEvidence(evidence.map(item=>({...item,domain:"stock" as const,metadata:item.metadata})));
    results.push({symbol,status:evidence.length?"measured":"no_matching_filing",received:evidence.length,accepted:persisted.accepted,saved:persisted.saved});
   }catch(e){results.push({symbol,status:"provider_error",reason:failureDetail(e)});}
  }
  const received=results.reduce((n,r)=>n+Number(r.received??0),0);
  const saved=results.reduce((n,r)=>n+Number(r.saved??0),0);
  await recordCollectorReceipt({collector:"sec_fundamentals",status:"finished",received,saved,details:{selected,results}});
  return NextResponse.json({selected,results,certified:false,ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"sec_fundamentals",status:"failed",received:0,saved:0,details:{selected,error:failureDetail(e),results}});}
  catch(receiptError){console.error("sec_fundamentals_receipt_write_failed",failureDetail(receiptError));}
  return NextResponse.json({status:"sec_fundamental_evidence_failed",error:failureDetail(e),selected,results,certified:false,ordersAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
