import {NextResponse} from "next/server";
import {bestSnapshots} from "../../../lib/market/live";
export const dynamic="force-dynamic";
const ticker=/^[A-Z][A-Z0-9.\-]{0,9}$/;
export async function GET(req:Request){
 const params=new URL(req.url).searchParams;
 const symbols=[...new Set((params.get("symbols")||"SPY,QQQ,NVDA").split(",").map(s=>s.trim().toUpperCase()))].slice(0,8);
 if(!symbols.length||symbols.some(x=>!ticker.test(x)))return NextResponse.json({error:"Use valid symbols (maximum eight)."}, {status:400});
 const asOf=new Date().toISOString();
 try{
  const response=await bestSnapshots(symbols);
  const matches=response.snapshots||[];
  const checks=symbols.map(symbol=>{
   const s=matches.find(x=>x.symbol?.toUpperCase()===symbol);
   const time=s?.timestamp?Date.parse(s.timestamp):NaN;
   const ageMs=Number.isFinite(time)?Date.now()-time:null;
   const isSane=ageMs!==null&&ageMs>=-60000;
   const ageMinutes=isSane?Math.round(ageMs!/60000*10)/10:null;
   const validPrice=typeof s?.price==="number"&&Number.isFinite(s.price)&&s.price>0;
   const dataPresent=Boolean(s&&response.provider&&validPrice&&isSane);
   const recent=Boolean(dataPresent&&ageMs!==null&&ageMs>=0&&ageMs<60000);
   return {symbol,provider:response.provider||null,sourceTimestamp:s?.timestamp||null,ageMinutes,priceValidated:validPrice,upstreamDataReturned:Boolean(s),status:!dataPresent?"unverified":recent?"recent_observation":ageMs!==null&&ageMs<20*60*1000?"delayed_or_unconfirmed":"stale",realtimeVerified:false,why:!response.provider?"No configured price provider produced a snapshot.":!s?"No quote returned for ticker.":!validPrice?"Missing/invalid price.":!isSane?"Missing/future timestamp.":recent?"Recent timestamp only; exchange entitlement and transport latency not proven.":"Observation older than 60 seconds; do not call it live."};
  });
  return NextResponse.json({generatedAt:asOf,scope:"read_only_data_freshness",checks,providerAttempts:response.attempts||[],policy:"No quote is certified real-time by timestamp alone. Real-time status additionally requires provider feed entitlement, exchange attribution, and verified network delivery; this endpoint does not assert these."},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({generatedAt:asOf,checks:[],status:"unavailable",error:error instanceof Error?error.message:"Upstream unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
