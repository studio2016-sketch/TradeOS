import {NextResponse} from "next/server";
import {bestSnapshots,alpacaSnapshots,massiveSnapshots} from "../../../lib/market/live";
import {reconcileDualSource} from "../../../lib/market/dual-source";
import type {MarketSnapshot} from "../../../lib/market/types";
export const dynamic="force-dynamic";

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const symbols=[...new Set((searchParams.get("symbols")??"SPY,QQQ,IWM,NVDA,AMD,PLTR").split(",").map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z0-9.-]{1,10}$/.test(s)))].slice(0,20);
 if(!symbols.length)return NextResponse.json({mode:"invalid_request",error:"No valid symbols."},{status:400});
 try{
  // Best available prices are provided for display only; independent verification
  // is calculated from both original provider responses, never from the chosen winner.
  const [best,primary,secondary]=await Promise.all([
    bestSnapshots(symbols),
    massiveSnapshots(symbols).then(data=>({data,error:null})).catch((e:unknown)=>({data:[] as MarketSnapshot[],error:e instanceof Error?e.message:String(e)})),
    alpacaSnapshots(symbols).then(data=>({data,error:null})).catch((e:unknown)=>({data:[] as MarketSnapshot[],error:e instanceof Error?e.message:String(e)}))
  ]);
  const now=Date.now();
  const checks=new Map(symbols.map(s=>[s,reconcileDualSource(s,[...primary.data,...secondary.data],now)]));
  const snapshots=best.snapshots.map(s=>{
   const verification=checks.get(s.symbol);
   const stamp=Date.parse(s.timestamp);
   const ageMs=Number.isFinite(stamp)?now-stamp:null;
   const quote=Date.parse(s.quoteTimestamp??"");
   return {...s,ageMs,quoteAgeMs:Number.isFinite(quote)?now-quote:null,
     exchangeRealtimeCertified:false,
     freshness:ageMs!==null&&ageMs>=0?(ageMs<60_000?"recent_observation":ageMs<1_200_000?"delayed_observation":"stale"):"unknown",
     verification:verification??null,
     certifiedDecisionEligible:false // until security, entitlement, risk, and model gates also pass
   };
  });
  return NextResponse.json({
   mode:best.provider?"provider_data":"unconfigured",provider:best.provider,
   generatedAt:new Date(now).toISOString(),snapshots,
   sourceVerification:symbols.map(symbol=>checks.get(symbol)),
   sourceStatus:{massive:primary.error?"degraded":"responded",alpaca:secondary.error?"degraded":"responded"},
   attempts:best.attempts,
   dataPolicy:"Prices are informational until entitlement, independent verification, security identity and decision-risk gating are satisfied."
  },{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  return NextResponse.json({mode:"degraded",snapshots:[],error:error instanceof Error?error.message:String(error)},{status:502});
 }
}
