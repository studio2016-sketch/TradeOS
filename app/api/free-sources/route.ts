import {withPrivateRead} from "../../../lib/auth/private-read";
import {NextResponse} from "next/server";
import {freeOfficialSnapshot} from "../../../lib/market/freeOfficial";
export const dynamic="force-dynamic";
async function privateGET(req:Request){
  const {searchParams}=new URL(req.url);
  const symbols=(searchParams.get("symbols")||"NVDA,AMD,PLTR,SPY,QQQ,IWM").split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
  const snapshot=await freeOfficialSnapshot(symbols);
  return NextResponse.json({...snapshot,safety:{executionEligible:false,ordersAllowed:false,mode:"official-context-only"}});
}

export const GET=withPrivateRead(privateGET);
