import {NextResponse} from "next/server";
import {alpacaSnapshots,massiveSnapshots} from "../../../../lib/market/live";
import {reconcileDualSource} from "../../../../lib/market/dual-source";
import type {MarketSnapshot} from "../../../../lib/market/types";
export const dynamic="force-dynamic";

/** Diagnostic endpoint only: does not change trade decisions or authorize live execution. */
export async function GET(req:Request){
 const params=new URL(req.url).searchParams;
 const symbols=[...new Set((params.get("symbols")??"SPY,QQQ,NVDA").split(",").map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z0-9.-]{1,10}$/.test(s)))].slice(0,20);
 if(!symbols.length)return NextResponse.json({error:"At least one valid symbol required"},{status:400});
 const [a,b]=await Promise.allSettled([massiveSnapshots(symbols),alpacaSnapshots(symbols)]);
 const observations:MarketSnapshot[]=[
  ...(a.status==="fulfilled"?a.value:[]),
  ...(b.status==="fulfilled"?b.value:[])
 ];
 const checks=symbols.map(s=>reconcileDualSource(s,observations));
 return NextResponse.json({
  mode:"research_diagnostic_only",verifiedCount:checks.filter(c=>c.status==="verified").length,
  generatedAt:new Date().toISOString(),checks,
  sourceHealth:{
   massive:a.status==="fulfilled"?"responded":"failed",
   alpaca:b.status==="fulfilled"?"responded":"failed"
  },
  limitations:[
   "Feed agreement does not establish real-time exchange entitlements.",
   "Missing or incompatible market coverage fails closed.",
   "This endpoint is not connected to order authorization or model certification."
  ]
 },{headers:{"Cache-Control":"no-store"}});
}
