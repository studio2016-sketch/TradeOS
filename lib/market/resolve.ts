import {db} from "../db";
import {horizonMs} from "./horizon";

export async function resolveEligibleForecasts(limit=100){
  const sql=db();
  const forecasts=await sql`
    select f.*
    from forecast_ledger f
    left join forecast_outcomes o on o.forecast_id=f.id
    where o.forecast_id is null
    order by f.created_at asc
    limit ${limit}
  `;
  let resolved=0,skipped=0;
  const details:any[]=[];

  for(const f of forecasts as any[]){
    const duration=horizonMs(String(f.horizon));
    if(!duration){skipped++;details.push({id:f.id,reason:"unsupported_horizon"});continue;}
    const start=new Date(f.created_at);
    const end=new Date(start.getTime()+duration);
    if(Date.now()<end.getTime()){skipped++;continue;}

    const obs=await sql`
      select event_time,metadata
      from source_observations
      where data_class='market_snapshot'
        and symbol=${String(f.symbol)}
        and event_time >= ${start.toISOString()}
        and event_time <= ${new Date(end.getTime()+Math.min(duration,15*60_000)).toISOString()}
      order by event_time asc
      limit 5000
    `;
    if((obs as any[]).length<2){skipped++;details.push({id:f.id,reason:"insufficient_market_observations"});continue;}

    const rows=(obs as any[]).map((r:any)=>({t:new Date(r.event_time),p:Number(r.metadata?.price??0)})).filter(x=>x.p>0);
    if(rows.length<2){skipped++;continue;}
    const first=rows[0];
    const eligible=rows.filter(x=>x.t.getTime()>=end.getTime());
    const last=eligible[0]??rows[rows.length-1];
    const raw=(last.p-first.p)/first.p;
    const signed=String(f.direction)==="bearish"?-raw:raw;
    const favorable=Math.max(...rows.map(x=>String(f.direction)==="bearish"?(first.p-x.p)/first.p:(x.p-first.p)/first.p));
    const adverse=Math.min(...rows.map(x=>String(f.direction)==="bearish"?(first.p-x.p)/first.p:(x.p-first.p)/first.p));
    const threshold=.001;
    const correct=String(f.direction)==="neutral"?Math.abs(raw)<threshold:signed>threshold;
    const label=Math.abs(raw)<threshold?"flat":correct?"direction_correct":"direction_wrong";

    await sql`
      insert into forecast_outcomes
        (forecast_id,realized_return,max_favorable_excursion,max_adverse_excursion,outcome_label,was_correct,notes)
      values
        (${f.id},${raw},${favorable},${adverse},${label},${correct},'Automatically resolved from stored market observations')
      on conflict(forecast_id) do nothing
    `;
    resolved++;
    details.push({id:f.id,symbol:f.symbol,horizon:f.horizon,return:raw,correct,label});
  }
  return{checked:forecasts.length,resolved,skipped,details};
}
