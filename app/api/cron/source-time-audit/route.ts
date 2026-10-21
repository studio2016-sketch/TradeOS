import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 const rows=await sql`select symbol,source_id,count(*)::int as samples,max(event_time) as newest_event,max(received_at) as newest_receipt from source_observations where received_at > now()-interval '2 days' and data_class='market_snapshot' group by symbol,source_id`;
 const bySymbol=new Map<string,Set<string>>();
 for(const r of rows){const symbol=String(r.symbol),providers=bySymbol.get(symbol)??new Set<string>();providers.add(String(r.source_id).split(":")[0]);bySymbol.set(symbol,providers);}
 const coverage=[...bySymbol].map(([symbol,providers])=>({symbol,independentProviderCount:providers.size,sourceTimeCertified:false,reason:providers.size<2?"missing_independent_provider":"independent_time_and_value_reconciliation_required"}));
 return NextResponse.json({status:"source_time_audit",symbols:coverage,independentlyCertified:0,marketSources:rows.map(r=>({symbol:r.symbol,source:r.source_id,samples:r.samples,newestEvent:r.newest_event,newestReceipt:r.newest_receipt})),warning:"Two Alpaca feeds are not two independent sources; historical publication availability remains unverified."},{headers:{"Cache-Control":"no-store"}});
}
