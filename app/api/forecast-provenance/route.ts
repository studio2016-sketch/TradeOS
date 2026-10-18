import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {auditForecastProvenance} from "../../../lib/research/temporalProvenance";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Forecast database unavailable"},{status:503});
 try{
  const sql=db();
  const rows=await sql`select f.created_at as forecast_time,o.resolved_at as resolved_at,
   f.source_snapshot as source_snapshot,f.evidence as evidence,f.model_version as model_version
   from forecast_ledger f left join forecast_outcomes o on o.forecast_id=f.id
   order by f.created_at desc limit 10000`;
  const input=(rows as any[]).map(x=>({forecastTime:String(x.forecast_time),resolvedAt:x.resolved_at?String(x.resolved_at):null,sourceSnapshot:x.source_snapshot,evidence:x.evidence,modelVersion:String(x.model_version)}));
  return NextResponse.json({status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),audit:auditForecastProvenance(input),certification:"BLOCKED_UNTIL_POINT_IN_TIME_SOURCE_AND_PAIRED_MODEL_EVIDENCE",policy:"No adaptive weight promotion, model profit claim, or live-execution authorization from exploratory factors or retrospectively assessed history."},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",reason:"Forecast provenance inspection unavailable"},{status:503})}
}
