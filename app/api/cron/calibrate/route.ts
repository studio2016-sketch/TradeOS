import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  if(!authorizeCron(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  if(!hasDatabase()) return NextResponse.json({error:"database_unconfigured"},{status:503});

  const sql=db();

  await sql`delete from calibration_buckets where model_version in (
    select distinct model_version from forecast_ledger
  )`;

  await sql`
    insert into calibration_buckets
      (model_version,horizon,regime,bucket_low,bucket_high,sample_count,predicted_mean,observed_frequency,brier_score,updated_at)
    select
      f.model_version,
      f.horizon,
      f.regime,
      floor(f.probability*10)/10 as bucket_low,
      least(1.0,floor(f.probability*10)/10+0.0999) as bucket_high,
      count(*)::int,
      avg(f.probability),
      avg(case when o.was_correct then 1.0 else 0.0 end),
      avg(power(f.probability-(case when o.was_correct then 1.0 else 0.0 end),2)),
      now()
    from forecast_ledger f
    join forecast_outcomes o on o.forecast_id=f.id
    where o.was_correct is not null
    group by f.model_version,f.horizon,f.regime,floor(f.probability*10)/10
  `;

  await sql`
    insert into model_scorecards(model_version,strategy,regime,sample_count,win_rate,brier_score,drift_score,status,updated_at)
    select
      f.model_version,
      f.model_version,
      f.regime,
      count(*)::int,
      avg(case when o.was_correct then 1.0 else 0.0 end),
      avg(power(f.probability-(case when o.was_correct then 1.0 else 0.0 end),2)),
      case
        when count(*) < 30 then null
        else abs(
          avg(case when o.was_correct then 1.0 else 0.0 end) -
          coalesce(avg(case when o.was_correct then 1.0 else 0.0 end) filter (where f.created_at >= now()-interval '7 days'),
                   avg(case when o.was_correct then 1.0 else 0.0 end))
        )
      end,
      case
        when count(*) < 30 then 'observing'
        when avg(power(f.probability-(case when o.was_correct then 1.0 else 0.0 end),2)) <= 0.20 then 'healthy'
        when avg(power(f.probability-(case when o.was_correct then 1.0 else 0.0 end),2)) <= 0.25 then 'watch'
        else 'degraded'
      end,
      now()
    from forecast_ledger f
    join forecast_outcomes o on o.forecast_id=f.id
    where o.was_correct is not null
    group by f.model_version,f.regime
    on conflict(model_version,strategy,regime) do update set
      sample_count=excluded.sample_count,
      win_rate=excluded.win_rate,
      brier_score=excluded.brier_score,
      drift_score=excluded.drift_score,
      status=excluded.status,
      updated_at=excluded.updated_at
  `;

  await sql`
    insert into audit_events(event_type,entity_type,payload)
    values('calibration_refresh','system',jsonb_build_object(
      'resolvedForecasts',(select count(*) from forecast_outcomes where was_correct is not null),
      'buckets',(select count(*) from calibration_buckets),
      'at',now()
    ))
  `;

  const summary=await sql`
    select
      (select count(*) from forecast_ledger) as forecasts,
      (select count(*) from forecast_outcomes where was_correct is not null) as resolved,
      (select count(*) from calibration_buckets) as buckets
  `;

  return NextResponse.json({ok:true,summary:summary[0],generatedAt:new Date().toISOString()});
}
