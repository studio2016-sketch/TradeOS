import {authorizeRuntimeAudit} from '../../../lib/auth/scoped-runtime-audit';
import {runtimeAudit} from '../../../lib/operations/runtime-audit';
export const dynamic='force-dynamic';
export const maxDuration=15;
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
export async function GET(request:Request){
 const status=await authorizeRuntimeAudit(request);
 if(status!==200)return Response.json({error:'runtime_audit_unavailable'},{status,headers});
 if(new URL(request.url).search)return Response.json({error:'parameters_not_allowed'},{status:400,headers});
 const report=await runtimeAudit({now:Date.now,probe:async()=>{
  const {db}=await import('../../../lib/db');
  const rows=await db()`select 1::int as database_ok,
   (select max(created_at) from audit_events where event_type='ingestion_run') as last_ingestion,
   (select max(created_at) from audit_events where event_type='research_radar_snapshot') as last_research`;
  return rows[0]??null;
 }});
 return Response.json(report,{status:report.databaseReachable?200:503,headers});
}
