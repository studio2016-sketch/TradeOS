import {NextResponse} from "next/server";
import {historicalBars} from "../../../lib/market/features";
import {knownAtCutoff} from "../../../lib/market/replay";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const q=new URL(req.url).searchParams;
 const symbol=(q.get("symbol")||"SPY").trim().toUpperCase();
 const asOf=q.get("asOf")||"";
 const cutoff=Date.parse(asOf);
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)||!asOf||!Number.isFinite(cutoff)||cutoff>Date.now()||cutoff<Date.parse("2000-01-01T00:00:00Z"))return NextResponse.json({error:"Use a valid supported ticker and an asOf date in the past."},{status:400});
 try{
  const feed=process.env.ALPACA_FEED||"iex";
  const start=new Date(cutoff-10*86400000).toISOString();
  let bars:Awaited<ReturnType<typeof historicalBars>>=[];
  let usedFeed=feed;
  let providerWarning:string|null=null;
  try{
   bars=await historicalBars(symbol,"5Min",start,1000,feed,new Date(cutoff).toISOString());
  }catch(err){
   if(feed==="iex")throw err;
   usedFeed="iex";
   providerWarning="Configured historical feed unavailable; fell back to Alpaca IEX, which can have different market coverage.";
   bars=await historicalBars(symbol,"5Min",start,1000,"iex",new Date(cutoff).toISOString());
  }
  bars=knownAtCutoff(bars,cutoff,5);
  return NextResponse.json({symbol,requestedAsOf:new Date(cutoff).toISOString(),source:"Alpaca:"+usedFeed,providerWarning,timeframe:"5Min",mode:bars.length?"recorded_bars_only":"unavailable",points:bars.slice(-120),latestRecordedAt:bars.at(-1)?.t??null,limitations:["Only price and volume bars are reproduced. This is not yet a fully point-in-time news, filings, or macro simulation.","No broker orders are placed.","Historical replay must not be mistaken for a backtested strategy return."]},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({mode:"unavailable",symbol,error:e instanceof Error?e.message:"Source unavailable",message:"Historical provider retrieval failed. No simulated price observations substituted."},{status:502,headers:{"Cache-Control":"no-store"}})}
}
