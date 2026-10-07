import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";

export const dynamic="force-dynamic";

function scoreReaction(ret:number,volumeRatio:number|null,minutes:number){
  const direction=Math.min(35,Math.abs(ret)*100*8);
  const volume=volumeRatio==null?0:Math.min(30,Math.max(0,(volumeRatio-1)*15));
  const persistence=Math.min(20,minutes>=30?20:minutes/30*20);
  const magnitude=Math.min(15,Math.abs(ret)*100*4);
  return Math.max(0,Math.min(100,direction+volume+persistence+magnitude));
}

export async function GET(req:Request){
  if(!hasDatabase()) return NextResponse.json({mode:"database_unconfigured",reactions:[]});
  const sql=db();
  const {searchParams}=new URL(req.url);
  const symbol=searchParams.get("symbol")?.toUpperCase();

  const catalysts=await sql`
    select id,entity_id,payload,created_at
    from audit_events
    where event_type='catalyst_observed'
      and (${symbol??null}::text is null or upper(payload->>'symbol')=${symbol??null})
    order by created_at desc
    limit 100
  `;

  const reactions:any[]=[];
  for(const c of catalysts){
    const p:any=c.payload;
    const eventAt=new Date(p.acceptedAt||p.filedAt||c.created_at);
    if(Number.isNaN(eventAt.getTime())) continue;
    const obs=await sql`
      select symbol,event_time,metadata
      from source_observations
      where data_class='market_snapshot'
        and symbol=${String(p.symbol)}
        and event_time >= ${eventAt.toISOString()}
        and event_time <= ${new Date(eventAt.getTime()+24*60*60*1000).toISOString()}
      order by event_time asc
      limit 500
    `;
    if(obs.length<2) continue;
    const first:any=obs[0].metadata,last:any=obs[obs.length-1].metadata;
    const p0=Number(first.price||0),p1=Number(last.price||0);
    if(!(p0>0&&p1>0)) continue;
    const ret=(p1-p0)/p0;
    const minutes=Math.max(0,(new Date(obs[obs.length-1].event_time).getTime()-new Date(obs[0].event_time).getTime())/60000);
    const v0=Number(first.volume||0),v1=Number(last.volume||0);
    const volumeRatio=v0>0&&v1>0?Math.max(v1/v0,v0/v1):null;
    reactions.push({
      catalystId:c.entity_id,
      symbol:p.symbol,
      form:p.form,
      acceptedAt:p.acceptedAt||p.filedAt,
      firstPrice:p0,
      latestPrice:p1,
      returnPct:+(ret*100).toFixed(3),
      observedMinutes:+minutes.toFixed(1),
      volumeRatio:volumeRatio==null?null:+volumeRatio.toFixed(2),
      reactionScore:+scoreReaction(ret,volumeRatio,minutes).toFixed(1),
      classification:Math.abs(ret)<.003?"low-reaction":Math.abs(ret)<.01?"moderate-reaction":"strong-reaction"
    });
  }

  return NextResponse.json({mode:"observed",reactions,generatedAt:new Date().toISOString()});
}
