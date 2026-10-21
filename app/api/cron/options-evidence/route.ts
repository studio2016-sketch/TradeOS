import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {alpacaOptionSurface} from "../../../../lib/market/options";
import {persistEvidence} from "../../../../lib/research/persist-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=60;
const symbols=["SPY","QQQ","NVDA","AAPL","TSLA","AMD"];
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const now=new Date();
 const selected=symbols.slice((Math.floor(now.getTime()/3600000)%3)*2,(Math.floor(now.getTime()/3600000)%3)*2+2);
 const results:{symbol:string;status:string;saved?:number;accepted?:number;contracts?:number;reason?:string}[]=[];
 try{
  for(const symbol of selected){
   try{
    const surface=await alpacaOptionSurface(symbol);
    if(!surface||surface.contractCount===0){results.push({symbol,status:"no_eligible_contracts"});continue;}
    const availableAt=new Date().toISOString();
    const candidates=[
     ["implied_vol_atm",surface.atmIv],
     ["iv_skew",surface.putCallIvSkew]
    ].flatMap(([factor,value])=>typeof value==="number"&&Number.isFinite(value)?[{
     factor:String(factor),value,source:"Alpaca options:"+surface.feed,subject:symbol,
     observedAt:surface.generatedAt,availableAt,domain:"option" as const,
     metadata:{contractCount:surface.contractCount,quoteCoverage:surface.quoteCoverage,backtestEligible:false}
    }]:[]);
    const persisted=await persistEvidence(candidates);
    results.push({symbol,status:"observed_uncertified",saved:persisted.saved,accepted:persisted.accepted,contracts:surface.contractCount});
   }catch(e){results.push({symbol,status:"provider_error",reason:failureDetail(e)});}
  }
  const saved=results.reduce((n,r)=>n+Number(r.saved??0),0);
  await recordCollectorReceipt({collector:"alpaca_options",status:"finished",received:results.length,saved,details:{results}});
  return NextResponse.json({results,certified:false,ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"alpaca_options",status:"failed",received:results.length,saved:0,details:{error:failureDetail(e),results}});}
  catch(receiptError){console.error("alpaca_options_receipt_write_failed",failureDetail(receiptError));}
  return NextResponse.json({status:"options_evidence_failed",error:failureDetail(e),results,certified:false,ordersAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
