import {NextResponse} from "next/server";
import {bestSnapshots} from "../../../lib/market/live";
export const dynamic="force-dynamic";

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbols=(searchParams.get("symbols")??"SPY,QQQ,IWM,NVDA,AMD,PLTR").split(",");
  try{
    const result=await bestSnapshots(symbols);
    const now=Date.now();
    const snapshots=result.snapshots.map(s=>({
      ...s,
      ageMs:Number.isFinite(Date.parse(s.timestamp))?now-Date.parse(s.timestamp):null,
      freshness:Number.isFinite(Date.parse(s.timestamp))&&Date.parse(s.timestamp)<=now
        ? (now-Date.parse(s.timestamp)<60*1000?"recent_observation":now-Date.parse(s.timestamp)<20*60*1000?"delayed_observation":"stale")
        : "unknown"
    }));
    return NextResponse.json({
      mode:result.provider?"provider_data":"unconfigured",
      provider:result.provider,
      generatedAt:new Date().toISOString(),
      snapshots,
      attempts:result.attempts
    });
  }catch(error){
    return NextResponse.json({mode:"degraded",snapshots:[],error:error instanceof Error?error.message:String(error)},{status:502});
  }
}
