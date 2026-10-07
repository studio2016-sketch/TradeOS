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
      ageMs:Math.max(0,now-new Date(s.timestamp).getTime()),
      freshness:new Date(s.timestamp).getTime()>0
        ? (now-new Date(s.timestamp).getTime()<5000?"live":now-new Date(s.timestamp).getTime()<20*60*1000?"delayed":"stale")
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
