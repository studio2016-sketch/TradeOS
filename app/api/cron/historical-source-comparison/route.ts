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
 // Persist all paired closes in one database statement, avoiding hundreds of
 // sequential round trips that can exceed the cron function time limit.
 const pairs=report.pairedCloses.map(pair=>({
  trading_day:pair.date,
  primary_close:pair.massiveClose,
  independent_close:pair.alpacaClose,
  close_difference_bps:pair.differenceBps,
  status:pair.differenceBps<=100?"price_reconciled_only":"price_discrepancy"
 }));
 let reconciled=0;
 if(pairs.length>0){
  const rows=await sql`
   insert into tradeos_historical_price_reconciliations
    (symbol,trading_day,primary_source,independent_source,primary_close,independent_close,close_difference_bps,status,retrieved_at)
   select ${symbol},p.trading_day,${report.primary},${report.secondary},
    p.primary_close,p.independent_close,p.close_difference_bps,p.status,${report.asOf}::timestamptz
   from jsonb_to_recordset(${JSON.stringify(pairs)}::jsonb) as p(
    trading_day date,primary_close numeric,independent_close numeric,
    close_difference_bps numeric,status text
   )
   on conflict(symbol,trading_day,primary_source,independent_source)
   do update set primary_close=excluded.primary_close,
    independent_close=excluded.independent_close,
    close_difference_bps=excluded.close_difference_bps,
    status=excluded.status,retrieved_at=excluded.retrieved_at
   returning id
  `;
  reconciled=rows.length;
 }
 await sql`insert into tradeos_collector_runs(collector,status,received,saved,details)
  values('historical_source_comparison',${report.overlap>0?"compared":"no_overlap"},${report.overlap},${reconciled},${JSON.stringify({...report,reconciledStored:reconciled})}::jsonb)`;
 return NextResponse.json({...report,reconciledStored:reconciled},{headers:{"Cache-Control":"no-store"}});
}
