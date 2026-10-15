import {NextResponse} from "next/server";
import {historicalBars} from "../../../lib/market/features";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  const u=new URL(req.url);
  const symbol=(u.searchParams.get("symbol")||"NVDA").toUpperCase();
  const minutes=Math.max(60,Math.min(10080,Number(u.searchParams.get("minutes")||480)));
  const requested=(u.searchParams.get("timeframe")||"5Min");
  const timeframe=["1Min","5Min","15Min"].includes(requested)?requested:"5Min";
  const end=new Date();
  const start=new Date(end.getTime()-minutes*60_000);
  try{
    const bars=await historicalBars(symbol,timeframe,start.toISOString(),1000,process.env.ALPACA_FEED||"iex");
    const points=bars.slice(-180).map(b=>({t:b.t,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v,vw:b.vw??null}));
    const last=points[points.length-1]??null;
    const ageMs=last?Math.max(0,Date.now()-new Date(last.t).getTime()):null;
    return NextResponse.json({
      symbol,timeframe,mode:points.length?"provider_history":"unavailable",
      source:"Alpaca:"+(process.env.ALPACA_FEED||"iex"),
      coverage:(process.env.ALPACA_FEED||"iex")==="iex"?"IEX only":"Configured feed",
      points,lastUpdated:last?.t??null,ageMs,
      freshness:ageMs==null?"unavailable":ageMs<120000?"recent_observation":ageMs<1200000?"delayed_observation":"stale",
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return NextResponse.json({symbol,mode:"degraded",points:[],error:error instanceof Error?error.message:String(error),generatedAt:new Date().toISOString()},{status:502});
  }
}
