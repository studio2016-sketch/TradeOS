import {NextResponse} from "next/server";
import {validateEvidence} from "../../../../lib/research/evidence-gate";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {secRatioEvidence} from "../../../../lib/research/sec-ratio-evidence";
export const dynamic="force-dynamic";
export const maxDuration=60;
const symbols=["AAPL","MSFT","NVDA","AMZN","META","GOOGL","AMD","TSLA","JPM","XOM"];
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 const day=Math.floor(Date.now()/86400000)%5;
 const results=[];
 for(const symbol of symbols.slice(day*2,day*2+2)){
  try{
   const evidence=await secRatioEvidence(symbol);
   let saved=0;
   for(const item of evidence){
    const gate=validateEvidence({...item,domain:"stock"});if(!gate.accepted)continue;
    const rows=await sql`insert into tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at,source_metadata) values(${item.factor},'stock',${item.subject},${item.value},${item.source},${item.observedAt},${item.availableAt},${JSON.stringify(item.metadata)}::jsonb) on conflict do nothing returning id`;
    saved+=rows.length;
   }
   results.push({symbol,status:evidence.length?"measured":"no_matching_filing",saved});
  }catch(e){results.push({symbol,status:"error",reason:e instanceof Error?e.message:"unknown"});}
 }
 return NextResponse.json({results,certified:false,ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
}
