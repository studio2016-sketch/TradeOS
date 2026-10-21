import {NextResponse} from "next/server";
import {validateEvidence} from "../../../../lib/research/evidence-gate";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {alpacaOptionSurface} from "../../../../lib/market/options";
export const dynamic="force-dynamic";
export const maxDuration=60;
const symbols=["SPY","QQQ","NVDA","AAPL","TSLA","AMD"];
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db(),now=new Date();
 const selected=symbols.slice((Math.floor(now.getTime()/3600000)%3)*2,(Math.floor(now.getTime()/3600000)%3)*2+2);
 const results=[];
 for(const symbol of selected){
  try{
   const surface=await alpacaOptionSurface(symbol);
   if(!surface||surface.contractCount===0){results.push({symbol,status:"no_eligible_contracts"});continue;}
   const values=[["implied_vol_atm",surface.atmIv],["iv_skew",surface.putCallIvSkew]] as const;
   let saved=0;
   for(const [factor,value] of values){
    if(value===null||!Number.isFinite(value))continue;
    const observedAt=surface.generatedAt,availableAt=new Date().toISOString();
    const gate=validateEvidence({factor,value,source:"Alpaca options:"+surface.feed,subject:symbol,observedAt,availableAt,domain:"option"});if(!gate.accepted)continue;
    const rows=await sql`insert into tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata)
    values(${factor},'option',${symbol},${value},${"Alpaca options:"+surface.feed},${observedAt},${availableAt},${JSON.stringify({contractCount:surface.contractCount,quoteCoverage:surface.quoteCoverage,backtestEligible:false})}::jsonb)
    on conflict do nothing returning id`;
    saved+=rows.length;
   }
   results.push({symbol,status:"observed_uncertified",saved,contracts:surface.contractCount});
  }catch(e){results.push({symbol,status:"provider_error",reason:e instanceof Error?e.message:"unknown"});}
 }
 await sql`insert into tradeos_collector_runs(collector,status,received,saved,details) values('alpaca_options','finished',${results.length},${results.reduce((n,r)=>n+Number(r.saved??0),0)},${JSON.stringify(results)}::jsonb)`;
 return NextResponse.json({results,certified:false,ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
}
