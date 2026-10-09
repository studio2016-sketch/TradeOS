import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  if(!hasDatabase()) return NextResponse.json({status:"database_unconfigured"});
  try{
    const sql=db();
    const [core,recentSources,recentCatalysts,models]=await Promise.all([
      sql`
        select
          (select count(*) from forecast_ledger)::int as forecasts,
          (select count(*) from forecast_outcomes where was_correct is not null)::int as resolved,
          (select count(*) from calibration_buckets)::int as calibration_buckets,
          (select count(*) from audit_events where event_type='catalyst_observed')::int as catalysts,
          (select count(*) from audit_events where event_type='research_subject_observed')::int as research_subjects,
          (select count(*) from audit_events where event_type='expert_view_observed')::int as expert_views,
          (select count(*) from audit_events where event_type='research_subject_outcome')::int as research_outcomes,
          (select count(*) from audit_events where event_type='expert_view_outcome')::int as expert_outcomes,
          (select max(created_at) from audit_events where event_type='ingestion_run') as last_ingestion,
          (select max(created_at) from audit_events where event_type='calibration_refresh') as last_calibration
      `,
      sql`
        select distinct on (source_id,data_class,coalesce(symbol,''))
          source_id,data_class,symbol,event_time,received_at,latency_ms,freshness_score,quality_score
        from source_observations
        order by source_id,data_class,coalesce(symbol,''),received_at desc
        limit 100
      `,
      sql`
        select entity_id,payload,created_at
        from audit_events
        where event_type='catalyst_observed'
        order by created_at desc
        limit 12
      `,
      sql`
        select model_version,strategy,regime,sample_count,win_rate,brier_score,drift_score,status,updated_at
        from model_scorecards
        order by sample_count desc,updated_at desc
        limit 12
      `
    ]);
    return NextResponse.json({
      status:"ok",
      core:core[0],
      recentSources,
      recentCatalysts,
      models,
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return NextResponse.json({status:"degraded",error:error instanceof Error?error.message:String(error)},{status:503});
  }
}
