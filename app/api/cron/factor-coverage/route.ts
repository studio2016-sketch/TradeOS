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
  const [coverage,registry,status]=await Promise.all([
   factorCoverageAudit(),
   sql`select factor_key,source_name,calculation_method,expected_cadence,freshness_seconds,implementation_status,permission_status from tradeos_factor_coverage_registry`,
   sql`select factor_key,populated_count,last_populated_at from tradeos_factor_coverage_status`
  ]);
  const readiness=auditFactorReadiness(
   registry.map(r=>({factor_key:String(r.factor_key),source_name:r.source_name as string|null,calculation_method:r.calculation_method as string|null,expected_cadence:r.expected_cadence as string|null,freshness_seconds:r.freshness_seconds as number|null,implementation_status:r.implementation_status as string|null,permission_status:r.permission_status as string|null})),
   status.map(r=>({factor_key:String(r.factor_key),populated_count:Number(r.populated_count??0),last_populated_at:r.last_populated_at?new Date(r.last_populated_at as string).toISOString():null})),
   new Date().toISOString()
  );
  return NextResponse.json({...coverage,readiness,dependencyInventory:factorDependencySummary()},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({error:"coverage_audit_failed",reason:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
