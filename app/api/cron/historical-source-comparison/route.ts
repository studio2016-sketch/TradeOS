import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {independentHistoryComparison} from "../../../../lib/research/independent-history-comparison";
export const dynamic="force-dynamic";
export const maxDuration=60;
const symbols=["SPY","QQQ","AAPL","MSFT","NVDA","AMD","TSLA","JPM"];
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const symbol=symbols[Math.floor(Date.now()/3600000)%symbols.length];
 const report=await independentHistoryComparison(symbol,new Date().toISOString());
 const sql=db();
 await sql`insert into tradeos_collector_runs(collector,status,received,saved,details) values('historical_source_comparison',${report.overlap>0?"compared":"no_overlap"},${report.overlap},0,${JSON.stringify(report)}::jsonb)`;
 return NextResponse.json(report,{headers:{"Cache-Control":"no-store"}});
}
