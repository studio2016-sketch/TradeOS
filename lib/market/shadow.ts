import {db} from "../db";

type Obs={event_time:string;metadata:any;freshness_score:number|null;quality_score:number|null};

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}

export async function generateShadowForecasts(symbols:string[]){
  const sql=db();
  const results:any[]=[];

  for(const symbol of symbols.filter(s=>!["VIX"].includes(s))){
    const recent=await sql`
      select event_time,metadata,freshness_score,quality_score
      from source_observations
      where data_class='market_snapshot'
        and symbol=${symbol}
        and event_time >= now()-interval '75 minutes'
      order by event_time asc
      limit 100
    ` as unknown as Obs[];

    if(recent.length<6){results.push({symbol,status:"insufficient_history",samples:recent.length});continue;}

    const rows=recent.map(r=>({
      t:new Date(r.event_time).getTime(),
      p:Number(r.metadata?.price??0),
      vwap:r.metadata?.vwap==null?null:Number(r.metadata.vwap),
      bid:r.metadata?.bid==null?null:Number(r.metadata.bid),
      ask:r.metadata?.ask==null?null:Number(r.metadata.ask),
      freshness:Number(r.freshness_score??0),
      quality:Number(r.quality_score??0)
    })).filter(r=>r.p>0);

    if(rows.length<6){results.push({symbol,status:"invalid_prices"});continue;}

    const last=rows[rows.length-1], first=rows[0];
    const ret=(last.p-first.p)/first.p;
    if(Math.abs(ret)<0.002){results.push({symbol,status:"no_edge",return:ret});continue;}

    const duplicate=await sql`
      select id from forecast_ledger
      where symbol=${symbol}
        and model_version='shadow-trend-v1'
        and horizon='30m'
        and created_at >= now()-interval '25 minutes'
      limit 1
    `;
    if((duplicate as any[]).length){results.push({symbol,status:"recent_forecast_exists"});continue;}

    const direction=ret>0?"bullish":"bearish";
    const alignedVwap=last.vwap==null?null:(direction==="bullish"?last.p>=last.vwap:last.p<=last.vwap);
    const spread=last.bid!=null&&last.ask!=null&&last.p>0?(last.ask-last.bid)/last.p:null;
    const avgFreshness=rows.reduce((s,r)=>s+r.freshness,0)/rows.length;
    const avgQuality=rows.reduce((s,r)=>s+r.quality,0)/rows.length;

    let probability=.52+Math.min(.10,Math.abs(ret)*4);
    if(alignedVwap===true)probability+=.02;
    if(alignedVwap===false)probability-=.02;
    if(spread!=null&&spread>.002)probability-=.025;
    probability=clamp(probability,.51,.66);

    const evidence=[
      {label:"75m price trend",value:+(ret*100).toFixed(3),direction,source:"stored_market_observations"},
      {label:"VWAP alignment",value:alignedVwap,direction:alignedVwap===true?direction:"mixed",source:"latest_snapshot"},
      {label:"Spread",value:spread==null?null:+(spread*100).toFixed(4),direction:spread!=null&&spread>.002?"mixed":"neutral",source:"latest_quote"},
      {label:"Observation quality",value:+avgQuality.toFixed(3),direction:"neutral",source:"source_health"}
    ];

    const inserted=await sql`
      insert into forecast_ledger
        (symbol,horizon,model_version,regime,direction,probability,decision,score,uncertainty,agreement,data_quality,evidence,warnings,source_snapshot)
      values
        (${symbol},'30m','shadow-trend-v1','intraday-trend',${direction},${probability},'wait',
         ${probability*100},${(1-probability)*100},${alignedVwap===true?75:55},
         ${avgQuality*avgFreshness*100},
         ${JSON.stringify(evidence)}::jsonb,
         ${JSON.stringify(["Shadow research only","Not eligible for execution"])}::jsonb,
         ${JSON.stringify({samples:rows.length,first:first.p,last:last.p,spread,avgFreshness,avgQuality})}::jsonb)
      returning id,created_at
    `;

    results.push({symbol,status:"created",forecast:(inserted as any[])[0],direction,probability});
  }

  return results;
}
