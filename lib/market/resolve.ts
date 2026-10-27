import {db} from "../db";
import {horizonMs} from "./horizon";
import {PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,PREDICTION_OUTCOME_RULE_VERSION,predictionOutcomeVerdict} from "../research/prediction-outcome-verdict";

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
      select source_id,event_time,received_at,metadata
      from source_observations
      where data_class='market_snapshot'
        and symbol=${String(f.symbol)}
        and event_time >= ${start.toISOString()}
        and event_time <= ${new Date(end.getTime()+Math.min(duration,15*60_000)).toISOString()}
      order by event_time asc
      limit 5000
    `;
    if((obs as any[]).length<2){skipped++;details.push({id:f.id,reason:"insufficient_market_observations"});continue;}

    const rows=(obs as any[]).map((r:any)=>({sourceId:String(r.source_id),t:new Date(r.event_time),receivedAt:new Date(r.received_at),p:Number(r.metadata?.price??0),bid:Number(r.metadata?.bid??0),ask:Number(r.metadata?.ask??0)})).filter(x=>x.p>0&&x.t<=x.receivedAt);
    if(rows.length<2){skipped++;continue;}
    const sources=[...new Set(rows.map(x=>x.sourceId))];
    const candidates=sources.flatMap(sourceId=>{const same=rows.filter(x=>x.sourceId===sourceId),first=same.find(x=>x.ask>x.bid&&x.bid>0),last=same.find(x=>x.t.getTime()>=end.getTime());return first&&last&&first.t.getTime()<=start.getTime()+5*60_000?[{first,last}]:[];}).sort((a,b)=>a.first.t.getTime()-b.first.t.getTime());
    if(!candidates.length){skipped++;details.push({id:f.id,reason:"complete_same_feed_horizon_unavailable"});continue;}
    const {first,last}=candidates[0];
    const sameFeedRows=rows.filter(x=>x.sourceId===first.sourceId&&x.t<=last.t);
    const raw=(last.p-first.p)/first.p;
    const favorable=Math.max(...sameFeedRows.map(x=>String(f.direction)==="bearish"?(first.p-x.p)/first.p:(x.p-first.p)/first.p));
    const adverse=Math.min(...sameFeedRows.map(x=>String(f.direction)==="bearish"?(first.p-x.p)/first.p:(x.p-first.p)/first.p));
    const midpoint=(first.ask+first.bid)/2,quotedRoundTripCost=first.ask>first.bid&&first.bid>0&&midpoint>0?(first.ask-first.bid)/midpoint:null;
    const verdict=predictionOutcomeVerdict({direction:String(f.direction),forecastAt:start.toISOString(),resolvedAt:last.t.toISOString(),realizedReturn:raw,quotedRoundTripCost});
    if(verdict.verdict==="VOID"||verdict.verdict==="UNRESOLVED"){skipped++;details.push({id:f.id,reason:verdict.reason});continue;}
    const correct=verdict.verdict==="PASS",label=correct?"pass":"fail";
    const prospective=start.getTime()>=Date.parse(PREDICTION_OUTCOME_PROTOCOL_ACTIVATION);
    const notes=JSON.stringify({...(prospective?{ruleVersion:PREDICTION_OUTCOME_RULE_VERSION}:{evidenceClass:"HISTORICAL_RECONSTRUCTION"}),sourceId:first.sourceId,startObservationTime:first.t.toISOString(),evaluationObservationTime:last.t.toISOString(),quotedRoundTripCost,minimumNetEdge:verdict.minimumNetEdge,reason:verdict.reason,protocolActivation:PREDICTION_OUTCOME_PROTOCOL_ACTIVATION});

    await sql`
      insert into forecast_outcomes
        (forecast_id,realized_return,max_favorable_excursion,max_adverse_excursion,outcome_label,was_correct,notes)
      values
        (${f.id},${raw},${favorable},${adverse},${label},${correct},${notes})
      on conflict(forecast_id) do nothing
    `;
    resolved++;
    details.push({id:f.id,symbol:f.symbol,horizon:f.horizon,return:raw,correct,label});
  }
  return{checked:forecasts.length,resolved,skipped,details};
}
