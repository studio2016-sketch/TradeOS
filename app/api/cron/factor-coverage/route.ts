import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {factorCoverageAudit} from "../../../../lib/research/factor-coverage-audit";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authorizeCron(request))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_not_configured"},{status:503});
 try{
  return NextResponse.json(await factorCoverageAudit(),{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({error:"coverage_audit_failed",reason:error instanceof Error?error.message:"unknown"},{status:503});
 }
}
