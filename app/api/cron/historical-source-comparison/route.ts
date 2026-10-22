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
 let reconciled=0;
 for(const pair of report.pairedCloses){
  const status=pair.differenceBps<=100?"price_reconciled_only":"price_discrepancy";
  const rows=await sql`insert into tradeos_historical_price_reconciliations(symbol,trading_day,primary_source,independent_source,primary_close,independent_close,close_difference_bps,status,retrieved_at) values(${symbol},${pair.date},${report.primary},${report.secondary},${pair.massiveClose},${pair.alpacaClose},${pair.differenceBps},${status},${report.asOf}::timestamptz) on conflict(symbol,trading_day,primary_source,independent_source) do update set primary_close=excluded.primary_close,independent_close=excluded.independent_close,close_difference_bps=excluded.close_difference_bps,status=excluded.status,retrieved_at=excluded.retrieved_at returning id`;
  reconciled+=rows.length;
 }
 await sql`insert into tradeos_collector_runs(collector,status,received,saved,details) values('historical_source_comparison',${report.overlap>0?"compared":"no_overlap"},${report.overlap},0,${JSON.stringify(report)}::jsonb)`;
 return NextResponse.json({...report,reconciledStored:reconciled},{headers:{"Cache-Control":"no-store"}});
}
