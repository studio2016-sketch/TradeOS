import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"database_unconfigured",hypothesisLedger:false,investigationLedger:false,eventsLedger:false,writeAccess:false});
 try{
 const sql=db();
 const rows=await sql`select table_name from information_schema.tables where table_schema='public' and table_name in ('agent_research_hypotheses','agent_investigations','agent_investigation_events')`;
 const tables=new Set(rows.map(r=>String(r.table_name)));
 return NextResponse.json({status:tables.size===3?"schema_ready":"migration_pending",hypothesisLedger:tables.has("agent_research_hypotheses"),investigationLedger:tables.has("agent_investigations"),eventsLedger:tables.has("agent_investigation_events"),writeAccess:false,automatedWorkers:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"database_check_unavailable",writeAccess:false,automatedWorkers:false},{status:503});}
}
