import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {configuredSourceHealth} from "../../../lib/market/providers";
import {freeOfficialSnapshot} from "../../../lib/market/freeOfficial";
import {bestSnapshots} from "../../../lib/market/live";

export const dynamic="force-dynamic";

export async function GET(){
  const configured=configuredSourceHealth();
  const [official,marketProbe]=await Promise.all([
    freeOfficialSnapshot(["NVDA","SPY","QQQ"]).catch(()=>null),
    bestSnapshots(["SPY"]).catch(()=>({provider:null,snapshots:[],attempts:[]}))
  ]);
  const runtime=new Map((official?.sources??[]).map((s:any)=>[s.id,s]));
  const sources=configured.map((s:any)=>{
    const r=runtime.get(s.id) as any;
    if(r)return {...s,state:r.status==="live"?"live":r.status==="degraded"?"degraded":"unconfigured",quality:r.status==="live"?95:r.status==="degraded"?45:0,note:r.error?r.note+" Runtime: "+r.error:r.note,runtimeVerified:true,generatedAt:r.generatedAt};
    if(s.id==="alpaca"||s.id==="massive"){
      const hit=(marketProbe as any)?.attempts?.find((a:any)=>a.source.toLowerCase().includes(s.id));
      const chosen=(marketProbe as any)?.provider?.toLowerCase().includes(s.id);
      const state=chosen?"live":hit?.error?"degraded":s.state;
      return {...s,state,quality:chosen?90:hit?.error?35:s.quality,note:hit?.error?s.note+" Runtime: "+hit.error:s.note,runtimeVerified:Boolean(chosen||hit),generatedAt:new Date().toISOString()};
    }
    return {...s,runtimeVerified:false};
  });
  if(!hasDatabase()) return NextResponse.json({status:"degraded",database:"unconfigured",sources});
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
      runtime:{marketProvider:(marketProbe as any)?.provider??null,marketAttempts:(marketProbe as any)?.attempts??[],official:{live:official?.live??0,degraded:official?.degraded??0,unconfigured:official?.unconfigured??0}},
      metrics:rows[0],
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return NextResponse.json({status:"degraded",database:"error",sources,error:error instanceof Error?error.message:String(error)},{status:503});
  }
}
