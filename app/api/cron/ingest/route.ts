import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {latestSecCatalysts} from "../../../../lib/market/sec";
import {bestSnapshots} from "../../../../lib/market/live";
import {resolveEligibleForecasts} from "../../../../lib/market/resolve";
import {generateShadowForecasts} from "../../../../lib/market/shadow";
import {curatedNews} from "../../../../lib/market/news";
import {latestRegimeContext} from "../../../../lib/market/fred";
import {observedMarketEvidence} from "../../../../lib/market/observedAssessment";
import {assess} from "../../../../lib/market/assessment";
import {configuredSourceHealth} from "../../../../lib/market/providers";
import {buildAlignment} from "../../../../lib/alignment/engine";
import {globalEventRisk} from "../../../../lib/market/globalRisk";
import {evaluateSupervisors} from "../../../../lib/alignment/supervisors";
import {alpacaOptionSurface} from "../../../../lib/market/options";
import {macroRiskContext} from "../../../../lib/market/bls";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  if(!authorizeCron(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  if(!hasDatabase()) return NextResponse.json({error:"database_unconfigured"},{status:503});

  const sql=db();
  const watchlist=(process.env.TRADEOS_WATCHLIST||"NVDA,AMD,PLTR,SPY,QQQ,IWM")
    .split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);

  const started=new Date();
  const results:any={startedAt:started.toISOString(),watchlist,sec:0,market:0,news:0,alignments:0,errors:[]};

  let catalysts:any[]=[];
  try{
    const secSymbols=watchlist.filter(s=>!["SPY","QQQ","IWM"].includes(s));
    catalysts=await latestSecCatalysts(secSymbols,8);
    for(const c of catalysts){
      await sql`
        insert into audit_events(event_type,entity_type,entity_id,payload)
        select 'catalyst_observed','sec_filing',${c.id},${JSON.stringify(c)}::jsonb
        where not exists(
          select 1 from audit_events where event_type='catalyst_observed' and entity_id=${c.id}
        )
      `;
    }
    results.sec=catalysts.length;
  }catch(e){results.errors.push({source:"sec",error:e instanceof Error?e.message:String(e)});}

  let market:any={provider:null,snapshots:[],attempts:[]};
  try{
    market=await bestSnapshots(watchlist);
    for(const s of market.snapshots){
      const eventTime=new Date(s.timestamp);
      const ageMs=Math.max(0,Date.now()-eventTime.getTime());
      const freshness=Math.max(0,Math.min(1,1-ageMs/(20*60*1000)));
      await sql`
        insert into source_observations
          (source_id,data_class,symbol,event_time,latency_ms,freshness_score,quality_score,metadata)
        values
          (${s.source},'market_snapshot',${s.symbol},${s.timestamp},${ageMs},${freshness},${market.provider==='Massive'?0.95:0.85},${JSON.stringify(s)}::jsonb)
      `;
    }
    results.market=market.snapshots.length;
    results.marketProvider=market.provider;
    results.marketAttempts=market.attempts;
  }catch(e){results.errors.push({source:"market",error:e instanceof Error?e.message:String(e)});}

  try{
    const curated=await curatedNews(watchlist,40);
    for(const n of curated.news){
      await sql`
        insert into audit_events(event_type,entity_type,entity_id,payload)
        select 'news_observed','provider_news',${n.id},${JSON.stringify(n)}::jsonb
        where not exists(
          select 1 from audit_events where event_type='news_observed' and entity_id=${n.id}
        )
      `;
    }
    results.news=curated.news.length;
    results.newsErrors=curated.errors;
  }catch(e){results.errors.push({source:"news",error:e instanceof Error?e.message:String(e)});}

  try{
    results.shadowForecasts=await generateShadowForecasts(watchlist);
  }catch(e){results.errors.push({source:"shadow",error:e instanceof Error?e.message:String(e)});}

  try{
    results.forecastResolution=await resolveEligibleForecasts(100);
  }catch(e){results.errors.push({source:"resolver",error:e instanceof Error?e.message:String(e)});}

  try{
    const observed=await observedMarketEvidence();
    const assessmentData=observed
      ? {mode:"observed_market_data",assessment:assess(observed.evidence),sources:configuredSourceHealth()}
      : {mode:"fallback_demo",assessment:null,sources:configuredSourceHealth()};
    const regimeRaw=await latestRegimeContext().catch(()=>null);
    const macro=await macroRiskContext().catch(()=>null);
    const regime=regimeRaw?{mode:regimeRaw.usableCount>0?"official_daily":"unavailable",...regimeRaw}:null;
    const calibrationRows=await sql`
      select count(*)::int as sample_count,
             avg(brier_score)::float as avg_brier
      from calibration_buckets
    `;
    const calibration={sampleCount:Number((calibrationRows as any[])[0]?.sample_count??0),confidenceMultiplier:.65};
    const marketContext={mode:market.provider?"provider_data":"unconfigured",...market};
    const governor=await globalEventRisk(market.snapshots,watchlist).catch(()=>null);
    if(governor){
      await sql`insert into audit_events(event_type,entity_type,model_version,payload) values('global_risk_snapshot','market','global-governor-v1',${JSON.stringify(governor)}::jsonb)`;
      results.globalRisk={level:governor.level,score:governor.score,verifiedTransmission:governor.verifiedTransmission};
    }
    for(const symbol of watchlist){
      const spot=market.snapshots.find((x:any)=>x.symbol===symbol)?.price;
      const optionSurface=await alpacaOptionSurface(symbol,spot).catch(()=>null);
      const baseAlignment=buildAlignment(symbol,{
        assessment:assessmentData,
        regime,
        catalysts:{mode:"live_authoritative",catalysts},
        market:marketContext,
        calibration,
        options:optionSurface,
        macro
      });
      const supervisors=evaluateSupervisors(baseAlignment,{calibration,options:optionSurface,regime});
      let finalBuy=governor?.buyClamp&&["MUST BUY","HIGH CONVICTION"].includes(baseAlignment.buyState)?"WATCH":baseAlignment.buyState;
      if(supervisors.buyVeto&&["MUST BUY","HIGH CONVICTION","READY"].includes(finalBuy))finalBuy="WATCH";
      let finalSell=governor?.capitalGuardOverride?"MUST SELL":governor?.level==="SEVERE"&&baseAlignment.sellState==="HOLD"?"CAUTION":baseAlignment.sellState;
      if(supervisors.sellEscalation>=30&&finalSell==="HOLD")finalSell="CAUTION";
      const alignment={...baseAlignment,buyState:finalBuy,sellState:finalSell,rawBuyState:baseAlignment.buyState,rawSellState:baseAlignment.sellState,governor,supervisors,optionSurface};
      await sql`
        insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
        values('alignment_snapshot','symbol',${symbol},'swiss-movement-v1',${JSON.stringify(alignment)}::jsonb)
      `;
      results.alignments++;
    }
  }catch(e){results.errors.push({source:"alignment",error:e instanceof Error?e.message:String(e)});}

  await sql`
    insert into audit_events(event_type,entity_type,payload)
    values('ingestion_run','system',${JSON.stringify({...results,finishedAt:new Date().toISOString()})}::jsonb)
  `;

  return NextResponse.json({...results,finishedAt:new Date().toISOString()});
}
