import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {alpacaOptionSurface} from "../../../../lib/market/options";
import {persistEvidence,type PersistableEvidence} from "../../../../lib/research/persist-evidence";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
import {computeIvRank} from "../../../../lib/research/iv-rank";
export const dynamic="force-dynamic";
export const maxDuration=120;
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
    const observedAt=surface.observedAt;
    if(!observedAt||surface.freshQuoteCount===0){results.push({symbol,status:"no_fresh_quotes",contracts:surface.contractCount});continue;}
    const availableAt=new Date().toISOString();
    const candidates:PersistableEvidence[]=[
     ["implied_vol_atm",surface.atmIv],
     ["iv_skew",surface.putCallIvSkew]
    ].flatMap(([factor,value])=>typeof value==="number"&&Number.isFinite(value)?[{
     factor:String(factor),value,source:"Alpaca options:"+surface.feed,subject:symbol,
     observedAt,availableAt,domain:"option" as const,
     metadata:{contractCount:surface.contractCount,freshQuoteCount:surface.freshQuoteCount,quoteCoverage:surface.quoteCoverage,feed:surface.feed,quoteEligibilityMaxAgeSeconds:surface.quoteEligibilityMaxAgeSeconds,liveFreshnessRequiredSeconds:300,backtestEligible:false}
    }]:[]);
    if(typeof surface.atmIv==="number"&&Number.isFinite(surface.atmIv)){
     const sql=db();
     const history=await sql`select distinct on (date_trunc('day',observed_at)) value,observed_at
       from tradeos_factor_evidence
       where factor_key='implied_vol_atm' and subject=${symbol} and observed_at<${observedAt}
         and observed_at>=${observedAt}::timestamptz-interval '550 days'
       order by date_trunc('day',observed_at),observed_at desc`;
     // 252 distinct prior observation days, not 20 points or 252 calendar days.\n     const rank=computeIvRank(surface.atmIv,history.map(r=>Number(r.value)));
     if(rank!==null)candidates.push({
      factor:"iv_rank",value:rank,source:"TradeOS persisted implied-volatility history + Alpaca options:"+surface.feed,
      subject:symbol,observedAt,availableAt,domain:"option" as const,
      metadata:{historyDays:history.length,minHistoricalSessions:252,lookbackCalendarDays:550,method:"(current_IV-min_IV)/(max_IV-min_IV)",feed:surface.feed,quoteEligibilityMaxAgeSeconds:surface.quoteEligibilityMaxAgeSeconds,liveFreshnessRequiredSeconds:300,backtestEligible:false}
     });
    }
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
