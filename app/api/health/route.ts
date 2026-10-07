import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {configuredSourceHealth} from "../../../lib/market/providers";

export const dynamic="force-dynamic";

export async function GET(){
  const sources=configuredSourceHealth();
  if(!hasDatabase()) return NextResponse.json({status:"degraded",database:"unconfigured",sources});
  try{
    const sql=db();
    const rows=await sql`
      select
        (select count(*) from forecast_ledger) as forecasts,
        (select count(*) from forecast_outcomes) as outcomes,
        (select count(*) from source_observations) as observations,
        (select count(*) from audit_events where event_type='catalyst_observed') as catalysts,
        (select max(created_at) from audit_events where event_type='ingestion_run') as last_ingestion,
        (select max(created_at) from audit_events where event_type='calibration_refresh') as last_calibration
    `;
    return NextResponse.json({
      status:"ok",
      database:"connected",
      sources,
      metrics:rows[0],
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return NextResponse.json({status:"degraded",database:"error",sources,error:error instanceof Error?error.message:String(error)},{status:503});
  }
}
