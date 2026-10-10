import {NextResponse} from "next/server";
import {freeOfficialSnapshot} from "../../../lib/market/freeOfficial";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbols=(searchParams.get("symbols")||"NVDA,AMD,PLTR,SPY,QQQ,IWM").split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
  const snapshot=await freeOfficialSnapshot(symbols);
  return NextResponse.json({...snapshot,safety:{executionEligible:false,ordersAllowed:false,mode:"official-context-only"}});
}
