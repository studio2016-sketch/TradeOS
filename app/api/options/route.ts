import {NextResponse} from "next/server";
import {bestSnapshots} from "../../../lib/market/live";
import {alpacaOptionSurface} from "../../../lib/market/options";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbol=(searchParams.get("symbol")||"NVDA").toUpperCase();
  try{
    const market=await bestSnapshots([symbol]);
    const spot=market.snapshots[0]?.price;
    const surface=await alpacaOptionSurface(symbol,spot);
    return NextResponse.json({
      mode:surface?"provider_data":"unconfigured",
      surface,
      marketProvider:market.provider,
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return NextResponse.json({mode:"degraded",surface:null,error:error instanceof Error?error.message:String(error)},{status:502});
  }
}
