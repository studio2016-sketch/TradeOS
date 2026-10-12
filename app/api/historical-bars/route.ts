import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const q=new URL(req.url).searchParams;
 const symbol=(q.get("symbol")||"SPY").toUpperCase();
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))return NextResponse.json({error:"Invalid symbol"},{status:400});
 if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return NextResponse.json({status:"unconfigured",bars:[],source:"Alpaca",message:"Historical data credentials unavailable"},{headers:{"Cache-Control":"no-store"}});
 try{
  const feed=process.env.ALPACA_FEED||"iex";const endpoint=new URL("https://data.alpaca.markets/v2/stocks/"+encodeURIComponent(symbol)+"/bars");
  endpoint.searchParams.set("timeframe","1Day");endpoint.searchParams.set("limit","80");endpoint.searchParams.set("adjustment","all");endpoint.searchParams.set("feed",feed);
  endpoint.searchParams.set("end",new Date().toISOString());
  endpoint.searchParams.set("start",new Date(Date.now()-180*86400000).toISOString());
  const res=await fetch(endpoint,{headers:{"APCA-API-KEY-ID":process.env.ALPACA_API_KEY,"APCA-API-SECRET-KEY":process.env.ALPACA_API_SECRET},cache:"no-store",signal:AbortSignal.timeout(14000)});
  if(!res.ok)return NextResponse.json({status:"unavailable",bars:[],source:"Alpaca:"+feed,message:"Historical bars unavailable on this feed (HTTP "+res.status+")"},{headers:{"Cache-Control":"no-store"}});
  const data=await res.json() as any;const bars=(Array.isArray(data.bars)?data.bars:[]).map((b:any)=>({time:b.t,open:Number(b.o),high:Number(b.h),low:Number(b.l),close:Number(b.c),volume:Number(b.v)})).filter((b:any)=>Number.isFinite(Date.parse(b.time))&&[b.open,b.high,b.low,b.close].every((n:number)=>Number.isFinite(n)&&n>0)&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close)).sort((a:any,b:any)=>a.time.localeCompare(b.time));
  return NextResponse.json({status:bars.length?"historical":"unavailable",symbol,source:"Alpaca:"+feed,adjustment:"all",timeframe:"1Day",asOf:new Date().toISOString(),bars,warning:"Daily bars are historical observations; not live prices. Source feed entitlements and reporting delays apply."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",symbol,bars:[],message:"Historical data fetch failed"},{headers:{"Cache-Control":"no-store"}})}
}
