import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {configuredSourceHealth} from "../../../lib/market/providers";
import {freeOfficialSnapshot} from "../../../lib/market/freeOfficial";
import {bestSnapshots} from "../../../lib/market/live";
import {latestRegimeContext} from "../../../lib/market/fred";
import {macroRiskContext} from "../../../lib/market/bls";
import {latestSecCatalysts} from "../../../lib/market/sec";
import {evaluateSourceReliability} from "../../../lib/market/sourceReliability";

export const dynamic="force-dynamic";

export async function GET(){
  const configured=configuredSourceHealth();
  const [official,marketProbe,fredProbe,macroProbe,secProbe]=await Promise.all([
    freeOfficialSnapshot(["NVDA","SPY","QQQ"]).catch(()=>null),
    bestSnapshots(["SPY"]).catch(()=>({provider:null,snapshots:[],attempts:[]})),
    latestRegimeContext().catch(()=>null),
    macroRiskContext().catch(()=>null),
    latestSecCatalysts(["NVDA"],1).catch(()=>null)
  ]);
  const runtime=new Map((official?.sources??[]).map((s:any)=>[s.id,s]));
  const sources=configured.map((s:any)=>{
    const r=runtime.get(s.id) as any;
    if(r)return {...s,state:r.status==="live"?"live":r.status==="degraded"?"degraded":"unconfigured",quality:r.status==="live"?95:r.status==="degraded"?45:0,note:r.error?r.note+" Runtime: "+r.error:r.note,runtimeVerified:true,generatedAt:r.generatedAt};
    if(s.id==="fred"){
      const ok=Boolean((fredProbe as any)?.usableCount>0);
      return {...s,state:ok?"live":"degraded",quality:ok?95:40,note:ok?"Runtime verified: "+(fredProbe as any).usableCount+" official FRED series usable.":s.note,runtimeVerified:true,generatedAt:(fredProbe as any)?.generatedAt??new Date().toISOString()};
    }
    if(s.id==="macro"){
      const ok=Boolean((macroProbe as any)?.source==="BLS");
      return {...s,state:ok?"live":"degraded",quality:ok?95:40,note:ok?"Runtime verified: BLS macro calendar reachable.":s.note,runtimeVerified:true,generatedAt:(macroProbe as any)?.generatedAt??new Date().toISOString()};
    }
    if(s.id==="sec"){
      const ok=Array.isArray(secProbe);
      return {...s,state:ok?"live":"degraded",quality:ok?100:40,note:ok?"Runtime verified: SEC EDGAR reachable; "+(secProbe as any[]).length+" current catalyst(s) returned for probe symbol.":s.note,runtimeVerified:true,generatedAt:new Date().toISOString()};
    }
    if(s.id==="alpaca"||s.id==="massive"){
      const hit=(marketProbe as any)?.attempts?.find((a:any)=>a.source.toLowerCase().includes(s.id));
      const chosen=(marketProbe as any)?.provider?.toLowerCase().includes(s.id);
      const state=chosen?"live":hit?.error?"degraded":s.state;
      return {...s,state,quality:chosen?90:hit?.error?35:s.quality,note:hit?.error?s.note+" Runtime: "+hit.error:s.note,runtimeVerified:Boolean(chosen||hit),generatedAt:new Date().toISOString()};
    }
    return {...s,runtimeVerified:false};
  });
  const reliability=evaluateSourceReliability({configured:sources,official,marketProbe});
  if(!hasDatabase()) return NextResponse.json({status:"degraded",database:"unconfigured",sources,reliability});
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
      runtime:{marketProvider:(marketProbe as any)?.provider??null,marketAttempts:(marketProbe as any)?.attempts??[],official:{live:official?.live??0,degraded:official?.degraded??0,unconfigured:official?.unconfigured??0},fredUsable:(fredProbe as any)?.usableCount??0,macroState:(macroProbe as any)?.state??null,secReachable:Array.isArray(secProbe)},
      reliability,
      metrics:rows[0],
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return NextResponse.json({status:"degraded",database:"error",sources,error:error instanceof Error?error.message:String(error)},{status:503});
  }
}
