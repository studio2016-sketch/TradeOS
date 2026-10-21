import {createHash} from "node:crypto";
import {TRIAL_ACTIVATION,CHALLENGER_VERSION,challengerProbability} from "../research/frozenChallenger";
import {db} from "../db";

type Obs={id:number;event_time:string;received_at:string;source_id:string;payload_hash:string|null;metadata:any;freshness_score:number|null;quality_score:number|null};

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}

export async function generateShadowForecasts(symbols:string[]){
  const sql=db();
  const results:any[]=[];

  for(const symbol of symbols.filter(s=>!["VIX"].includes(s))){
    const recent=await sql`
      select id,event_time,received_at,source_id,payload_hash,metadata,freshness_score,quality_score
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
      observationId:Number(r.id),
      receivedAt:new Date(r.received_at).toISOString(),
      payloadHash:r.payload_hash?String(r.payload_hash):null,
      sourceId:String(r.source_id??"unknown"),
      quoteObservedAt:typeof r.metadata?.quoteTimestamp==="string"?r.metadata.quoteTimestamp:null,
      p:Number(r.metadata?.price??0),
      vwap:r.metadata?.vwap==null?null:Number(r.metadata.vwap),
      bid:r.metadata?.bid==null?null:Number(r.metadata.bid),
      ask:r.metadata?.ask==null?null:Number(r.metadata.ask),
      freshness:Number(r.freshness_score??0),
      quality:Number(r.quality_score??0)
    })).filter(r=>r.p>0);

    if(rows.length<6){results.push({symbol,status:"invalid_prices"});continue;}

    const last=rows[rows.length-1], first=rows[0];
    // Stored observation event times are traceable ingestion times; they do not independently establish exchange publication times.
    if(last.t>Date.now()+60000){results.push({symbol,status:"future_dated_observation"});continue;}
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
         ${JSON.stringify({samples:rows.length,first:first.p,last:last.p,spread,avgFreshness,avgQuality,observedAt:new Date(last.t).toISOString(),firstObservedAt:new Date(first.t).toISOString(),sourceTimestampType:"stored_observation_event_time_not_exchange_certified",sourceDataCutoff:new Date(last.t).toISOString()})}::jsonb)
      returning id,created_at
    `;

    const forecast=(inserted as any[])[0];
    const sourceIdentity="source_observations:market_snapshot:"+symbol+":"+last.sourceId;
    const frozenFeatures={ret,alignedVwap,spread,avgFreshness,avgQuality,samples:rows.length,firstObservedAt:new Date(first.t).toISOString(),observedAt:new Date(last.t).toISOString(),
      quoteObservedAt:last.quoteObservedAt,sourceId:last.sourceId};
    const inputFingerprint=createHash("sha256").update(JSON.stringify(frozenFeatures)).digest("hex");
    const modelFingerprint=createHash("sha256").update("shadow-trend-v1|75m trend|VWAP|spread|quality|probability-v1").digest("hex");
    const decisionChecksum=createHash("sha256").update(JSON.stringify({
      modelVersion:"shadow-trend-v1",symbol,horizon:"30m",prediction:{probability,direction},
      observedAt:new Date(last.t).toISOString(),sourceIdentity,
      sourceType:"stored_observation_event_time",frozenFeatures,inputFingerprint,modelFingerprint
    })).digest("hex");
    let recorded=false;
    // Existing databases must execute db/schema.sql before this insert-only ledger becomes active.
    // Never invent a record on failure, and never interpret the older forecast ledger as immutable.
    try{
      const applied=await sql`
        insert into immutable_decision_records
          (model_version,symbol,horizon,prediction,observed_at,source_type,source_identity,features,
           input_fingerprint,model_fingerprint,created_checksum,policy_status,forecast_id)
        values
          ('shadow-trend-v1',${symbol},'30m',${JSON.stringify({probability,direction})}::jsonb,
           ${new Date(last.t).toISOString()}::timestamptz,'stored_observation_event_time',${sourceIdentity},
           ${JSON.stringify(frozenFeatures)}::jsonb,${inputFingerprint},${modelFingerprint},
           ${decisionChecksum},'research_only',${forecast.id})
        on conflict(forecast_id) do nothing returning id
      `;
      recorded=applied.length===1;
      if(recorded&&applied[0]?.id&&Number.isFinite(last.observationId)){
        await sql`insert into tradeos_decision_source_attestations(
          immutable_decision_id,source_observation_id,match_method,time_distance_ms,source_payload_hash,backfilled
        ) values(
          ${applied[0].id},${last.observationId},'direct_at_creation',
          ${Math.abs(last.t-Date.parse(new Date(last.t).toISOString()))},${last.payloadHash},false
        ) on conflict(immutable_decision_id) do nothing`;
        const forecastCreatedAt=new Date(forecast.created_at).toISOString();
        if(Date.parse(last.receivedAt)<=Date.parse(forecastCreatedAt)&&last.t<=Date.parse(forecastCreatedAt)){
          await sql`insert into tradeos_decision_source_verifications(
            immutable_decision_id,source_observation_id,verification_rule,source_event_time,source_received_at,forecast_created_at,source_payload_hash,backfilled
          ) values(
            ${applied[0].id},${last.observationId},'event_and_received_before_forecast',
            ${new Date(last.t).toISOString()},${last.receivedAt},${forecastCreatedAt},${last.payloadHash},false
          ) on conflict(immutable_decision_id) do nothing`;
        }
      }
    }catch(_){recorded=false;}
    // Prospective challenger only: never backfill historical predictions.
    if(recorded && Date.now()>=Date.parse(TRIAL_ACTIVATION)){
      const cProbability=challengerProbability({return75m:ret,vwapAligned:alignedVwap,spreadRatio:spread,quality:avgQuality});
      if(cProbability!==null){
        const duplicateChallenger=await sql`
          select id from forecast_ledger where symbol=${symbol}
            and model_version=${CHALLENGER_VERSION} and horizon='30m'
            and created_at >= now()-interval '25 minutes' limit 1
        `;
        if(!duplicateChallenger.length){
          const challenger=await sql`
            insert into forecast_ledger
              (symbol,horizon,model_version,regime,direction,probability,decision,score,uncertainty,agreement,data_quality,evidence,warnings,source_snapshot)
            values
              (${symbol},'30m',${CHALLENGER_VERSION},'prospective-shadow-trial',${direction},${cProbability},'wait',
               ${cProbability*100},${(1-cProbability)*100},${alignedVwap===true?75:55},
               ${avgQuality*avgFreshness*100},
               ${JSON.stringify(evidence)}::jsonb,
               ${JSON.stringify(["Frozen prospective challenger","Paper research only","Never eligible for automatic trade authorization"])}::jsonb,
               ${JSON.stringify({samples:rows.length,first:first.p,last:last.p,spread,avgFreshness,avgQuality,
                observedAt:new Date(last.t).toISOString(),firstObservedAt:new Date(first.t).toISOString(),
                trialStart:TRIAL_ACTIVATION,sourceTimestampType:"stored_observation_event_time_not_exchange_certified"})}::jsonb)
             returning id
          `;
          const challengerFingerprint=createHash("sha256").update("shadow-trend-v2|2.5 return cap .075|VWAP +.025 -.035|spread -.035|quality -.025|20261018").digest("hex");
          const challengerChecksum=createHash("sha256").update(JSON.stringify({
            modelVersion:CHALLENGER_VERSION,symbol,horizon:"30m",prediction:{probability:cProbability,direction},
            observedAt:new Date(last.t).toISOString(),sourceIdentity,
            sourceType:"stored_observation_event_time",frozenFeatures,inputFingerprint,modelFingerprint:challengerFingerprint
          })).digest("hex");
          const insertedChallenger=await sql`
            insert into immutable_decision_records
              (model_version,symbol,horizon,prediction,observed_at,source_type,source_identity,features,
               input_fingerprint,model_fingerprint,created_checksum,policy_status,forecast_id)
             values
              (${CHALLENGER_VERSION},${symbol},'30m',${JSON.stringify({probability:cProbability,direction})}::jsonb,
               ${new Date(last.t).toISOString()}::timestamptz,'stored_observation_event_time',${sourceIdentity},
               ${JSON.stringify(frozenFeatures)}::jsonb,${inputFingerprint},${challengerFingerprint},
               ${challengerChecksum},'research_only',${challenger[0].id})
             on conflict(forecast_id) do nothing returning id,recorded_at
          `;
          if(insertedChallenger.length&&Number.isFinite(last.observationId)){
            await sql`insert into tradeos_decision_source_attestations(
              immutable_decision_id,source_observation_id,match_method,time_distance_ms,source_payload_hash,backfilled
            ) values(
              ${insertedChallenger[0].id},${last.observationId},'direct_at_creation',0,${last.payloadHash},false
            ) on conflict(immutable_decision_id) do nothing`;
            const challengerCreatedAt=new Date(insertedChallenger[0].recorded_at).toISOString();
            if(Date.parse(last.receivedAt)<=Date.parse(challengerCreatedAt)&&last.t<=Date.parse(challengerCreatedAt)){
              await sql`insert into tradeos_decision_source_verifications(
                immutable_decision_id,source_observation_id,verification_rule,source_event_time,source_received_at,forecast_created_at,source_payload_hash,backfilled
              ) values(
                ${insertedChallenger[0].id},${last.observationId},'event_and_received_before_forecast',
                ${new Date(last.t).toISOString()},${last.receivedAt},${challengerCreatedAt},${last.payloadHash},false
              ) on conflict(immutable_decision_id) do nothing`;
            }
          }
          results.push({symbol,status:insertedChallenger.length?"prospective_challenger_recorded":"prospective_challenger_missing_immutable_record",version:CHALLENGER_VERSION});
        }
      }
    }
    results.push({symbol,status:recorded?"created_immutable_record":"created_legacy_only_not_immutable",
      forecast,direction,probability,immutableDecisionRecorded:recorded});
  }

  return results;
}
