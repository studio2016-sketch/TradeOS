import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {independentHistoryComparison} from "../../../../lib/research/independent-history-comparison";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const symbols=["SPY","QQQ"];
 const sql=db(),out=[];
 for(const symbol of symbols){
  const report=await independentHistoryComparison(symbol,new Date().toISOString());
  await sql`insert into tradeos_collector_runs(collector,status,received,saved,details) values('historical_source_comparison',${report.overlap>=20?"compared":"insufficient_overlap"},${report.overlap},0,${JSON.stringify(report)}::jsonb)`;
  out.push(report);
 }
 return NextResponse.json({reports:out,sourceTimeCertified:false},{headers:{"Cache-Control":"no-store"}});
}
