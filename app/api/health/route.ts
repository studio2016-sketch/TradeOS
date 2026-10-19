import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {configuredSourceHealth} from "../../../lib/market/providers";
import {freeOfficialSnapshot} from "../../../lib/market/freeOfficial";
import {latestRegimeContext} from "../../../lib/market/fred";
import {macroRiskContext} from "../../../lib/market/bls";
import {latestSecCatalysts} from "../../../lib/market/sec";
import {evaluateSourceReliability} from "../../../lib/market/sourceReliability";

export const dynamic="force-dynamic";

export async function GET(){
  const configured=configuredSourceHealth();
  const [official,fredProbe,macroProbe,secProbe]=await Promise.all([
    freeOfficialSnapshot(["NVDA","SPY","QQQ"]).catch(()=>null),
    latestRegimeContext().catch(()=>null),
    macroRiskContext().catch(()=>null),
    latestSecCatalysts(["NVDA"],1).catch(()=>null)
  ]);
  const runtime=new Map((official?.sources??[]).map((s:any)=>[s.id,s]));

  const buildSources=(marketProbe:any)=>configured.map((s:any)=>{
    const r=runtime.get(s.id) as any;
    if(r)return {...s,state:r.status==="live"?"live":r.status==="degraded"?"degraded":"unconfigured",quality:r.status==="live"?95:r.status==="degraded"?45:0,note:r.error?r.note+" Runtime: "+r.error:r.note,runtimeVerified:r.status==="live",generatedAt:r.generatedAt};
    if(s.id==="fred"){
      const ok=Boolean((fredProbe as any)?.usableCount>0);
      return {...s,state:ok?"live":"degraded",quality:ok?95:40,note:ok?"Runtime verified: "+(fredProbe as any).usableCount+" official FRED series usable.":s.note,runtimeVerified:ok,generatedAt:(fredProbe as any)?.generatedAt??new Date().toISOString()};
    }
    if(s.id==="macro"){
      const ok=Boolean((macroProbe as any)?.source==="BLS");
      return {...s,state:ok?"live":"degraded",quality:ok?95:40,note:ok?"Runtime verified: BLS macro calendar reachable.":s.note,runtimeVerified:ok,generatedAt:(macroProbe as any)?.generatedAt??new Date().toISOString()};
    }
    if(s.id==="sec"){
      const ok=Array.isArray(secProbe);
      return {...s,state:ok?"live":"degraded",quality:ok?100:40,note:ok?"Runtime verified: SEC EDGAR reachable; "+(secProbe as any[]).length+" current catalyst(s) returned for probe symbol.":s.note,runtimeVerified:ok,generatedAt:new Date().toISOString()};
    }
    if(s.id==="alpaca"||s.id==="massive"){
      const chosen=String(marketProbe?.provider??"").toLowerCase().includes(s.id);
      const state=chosen?"live":s.state;
      return {...s,state,quality:chosen?90:s.quality,note:chosen?s.note+" Verified from the latest persisted market observation.":s.note,runtimeVerified:chosen,generatedAt:marketProbe?.snapshots?.[0]?.timestamp??null};
    }
    return {...s,runtimeVerified:false};
  });

  if(!hasDatabase()){
    const sources=buildSources(null);
    const reliability=evaluateSourceReliability({configured:sources,official,marketProbe:null});
    return NextResponse.json({status:"degraded",database:"unconfigured",sources,reliability});
  }

  try{
    const sql=db();
    const [rows,marketRows]=await Promise.all([
      sql`
        select
          (select count(*) from forecast_ledger) as forecasts,
          (select count(*) from forecast_outcomes) as outcomes,
          (select count(*) from source_observations) as observations,
          (select count(*) from audit_events where event_type='catalyst_observed') as catalysts,
          (select max(created_at) from audit_events where event_type='ingestion_run') as last_ingestion,
          (select max(created_at) from audit_events where event_type='calibration_refresh') as last_calibration
      `,
      sql`
        select source_id,event_time,metadata
        from source_observations
        where data_class='market_snapshot'
        order by event_time desc
        limit 12
      `
    ]);

    const persisted=(marketRows as any[]).map((r:any)=>({
      ...(r.metadata??{}),
      timestamp:r.metadata?.timestamp??r.event_time,
      source:r.metadata?.source??r.source_id
    }));
    const sourceName=String(persisted[0]?.source??"");
    const provider=/massive/i.test(sourceName)?"Massive":/alpaca/i.test(sourceName)?"Alpaca":null;
    const marketProbe={provider,snapshots:persisted,attempts:provider?[{source:provider,count:persisted.length}]:[]};

    const sources=buildSources(marketProbe);
    const reliability=evaluateSourceReliability({configured:sources,official,marketProbe});

    return NextResponse.json({
      status:"ok",
      database:"connected",
      sources,
      runtime:{
        marketProvider:provider,
        marketMode:"persisted_observation_health",
        marketAttempts:marketProbe.attempts,
        latestMarketObservation:persisted[0]?.timestamp??null,
        official:{live:official?.live??0,degraded:official?.degraded??0,unconfigured:official?.unconfigured??0},
        fredUsable:(fredProbe as any)?.usableCount??0,
        macroState:(macroProbe as any)?.state??null,
        secReachable:Array.isArray(secProbe)
      },
      reliability,
      metrics:(rows as any[])[0],
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    const sources=buildSources(null);
    const reliability=evaluateSourceReliability({configured:sources,official,marketProbe:null});
    return NextResponse.json({status:"degraded",database:"error",sources,reliability,error:error instanceof Error?error.message:String(error)},{status:503});
  }
}
