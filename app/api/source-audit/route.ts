import {NextResponse} from "next/server";
import {bestSnapshots} from "../../../lib/market/live";
import {historicalBars} from "../../../lib/market/features";
import {observedAgeMs,observationState} from "../../../lib/market/freshness";
export const dynamic="force-dynamic";
const symbols=["SPY","QQQ","NVDA"];
export async function GET(){
 const asOf=new Date().toISOString();
 const results=await Promise.allSettled([
  bestSnapshots(symbols),
  historicalBars("SPY","1Min",new Date(Date.now()-90*60000).toISOString(),100,process.env.ALPACA_FEED||"iex"),
  historicalBars("SPY","1Day",new Date(Date.now()-40*86400000).toISOString(),40,process.env.ALPACA_FEED||"iex")
 ]);
 const market=results[0].status==="fulfilled"?results[0].value:null;
 const snapshots=symbols.map(symbol=>{
  const s=market?.snapshots.find(x=>x.symbol===symbol);
  return {symbol,state:s?observationState(s.timestamp):"unavailable",source:s?.source??null,lastObserved:s?.timestamp??null,ageMinutes:s?Math.round((observedAgeMs(s.timestamp)??0)/60000):null,pricePresent:Boolean(s&&s.price>0),bidAskPresent:Boolean(s?.bid&&s?.ask&&s.bid>0&&s.ask>=s.bid),exchangeRealtimeCertified:false};
 });
 const describe=(index:number,label:string)=>{
  const entry=results[index];
  if(entry.status==="rejected")return {label,status:"error",count:0,lastObserved:null,message:"Provider request failed. Entitlement or connectivity may need review."};
  const bars=entry.value as {t:string;c:number}[];
  const good=Array.isArray(bars)?bars.filter(b=>Number.isFinite(Date.parse(b.t))&&Number.isFinite(b.c)&&b.c>0):[];
  const last=good.at(-1);
  return {label,status:good.length?"historical_data":"unavailable",count:good.length,lastObserved:last?.t??null,message:good.length?"Dated bars returned; not proof of streaming.":"Provider returned no valid bars."};
 };
 const attempts=(market?.attempts??[]).map(x=>({source:x.source,status:x.error?"error":"response",count:x.count??0,message:x.error?x.error.replace(/apiKey=[^& ]+/gi,"apiKey=[redacted]"):"Provider request completed"}));
 const allUnavailable=snapshots.every(s=>s.state==="unavailable");
 return NextResponse.json({generatedAt:asOf,overall:allUnavailable?"unavailable":snapshots.some(s=>s.state==="recent_observation")?"recent_observations":"historical_or_stale",productionCertification:"NOT_CERTIFIED",snapshots,barChecks:[describe(1,"Alpaca 1-minute SPY"),describe(2,"Alpaca daily SPY")],providerAttempts:attempts,limits:["This is a per-request source probe, not a historical uptime or exchange-entitlement audit.","Market closure, holidays and provider subscriptions may explain unchanged observations.","Model scores, economic sources, news, options and account balances require independent source tests."]},{headers:{"Cache-Control":"private, no-store"}});
}
