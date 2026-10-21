import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {factorCoverageAudit} from "../../../../lib/research/factor-coverage-audit";
import {auditFactorReadiness} from "../../../../lib/research/factor-readiness";
import {factorDependencySummary} from "../../../../lib/research/factor-dependency-inventory";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_not_configured"},{status:503});
 try{
  const sql=db();
  const [coverage,registry,status,collectorRuns,evidenceSummary]=await Promise.all([
   factorCoverageAudit(),
   sql`select factor_key,source_name,calculation_method,expected_cadence,freshness_seconds,implementation_status,permission_status from tradeos_factor_coverage_registry`,
   sql`select r.factor_key,(coalesce(s.populated_count,0)+coalesce(e.evidence_count,0))::int as populated_count,greatest(s.last_populated_at,e.latest_evidence_at) as last_populated_at from tradeos_factor_coverage_registry r left join tradeos_factor_coverage_status s using(factor_key) left join (select factor_key,count(*)::int as evidence_count,max(available_at) as latest_evidence_at from tradeos_factor_evidence group by factor_key) e using(factor_key)`,
   sql`select collector,status,count(*)::int as runs,max(started_at) as last_run,sum(received)::int as received,sum(saved)::int as saved from tradeos_collector_runs group by collector,status order by last_run desc`,
   sql`select count(*)::int as evidence_rows,count(distinct factor_key)::int as evidenced_factors,max(available_at) as latest_available_at from tradeos_factor_evidence`
  ]);
  const readiness=auditFactorReadiness(
   registry.map(r=>({factor_key:String(r.factor_key),source_name:r.source_name as string|null,calculation_method:r.calculation_method as string|null,expected_cadence:r.expected_cadence as string|null,freshness_seconds:r.freshness_seconds as number|null,implementation_status:r.implementation_status as string|null,permission_status:r.permission_status as string|null})),
   status.map(r=>({factor_key:String(r.factor_key),populated_count:Number(r.populated_count??0),last_populated_at:r.last_populated_at?new Date(r.last_populated_at as string).toISOString():null})),
   new Date().toISOString()
  );
  const evidence=evidenceSummary[0]??{evidence_rows:0,evidenced_factors:0,latest_available_at:null};
  return NextResponse.json({
   ...coverage,
   readiness,
   dependencyInventory:factorDependencySummary(),
   collectorHealth:collectorRuns.map(r=>({collector:String(r.collector),status:String(r.status),runs:Number(r.runs),lastRun:r.last_run,received:Number(r.received??0),saved:Number(r.saved??0)})),
   evidencePersistence:{rows:Number(evidence.evidence_rows??0),factors:Number(evidence.evidenced_factors??0),latestAvailableAt:evidence.latest_available_at??null},
   approvedForTrading:false
  },{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({error:"coverage_audit_failed",reason:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
