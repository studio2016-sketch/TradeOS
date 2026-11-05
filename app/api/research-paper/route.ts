import {NextResponse} from "next/server";
import {observedPaperQuote} from "../../../lib/paper/observedQuote";
import {bestSnapshots} from "../../../lib/market/live";
import {researchToPaper} from "../../../lib/paper/researchBridge";
export const dynamic="force-dynamic";
/** Read-only bridge demo. No endpoint can place an order. */
export async function GET(req:Request){
 const symbol=(new URL(req.url).searchParams.get("symbol")||"SPY").toUpperCase();
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))return NextResponse.json({error:"Invalid symbol"},{status:400});
 try{
  const origin=new URL(req.url).origin;
  const [a,m]=await Promise.all([
   fetch(origin+"/api/alignment?symbol="+encodeURIComponent(symbol),{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null),
   bestSnapshots([symbol]).catch(()=>null)
  ]);
  const s=m?.snapshots?.find(x=>x.symbol===symbol);
  const observed=m?.provider?observedPaperQuote(s,symbol):null;
  const validQuote=observed!==null;
  const price=observed?.quote.ask??null;
  const order={side:"buy" as const,symbol,quantity:1,limitPrice:price??1,stopPrice:price?+(price*.98).toFixed(4):0.98,targetPrice:price?+(price*1.04).toFixed(4):1.04,maxRisk:100};
  const portfolio={equity:10000,cash:10000,dailyRealizedPnl:0,positions:[],candidate:{symbol,sector:"Unclassified",notional:order.limitPrice,plannedRisk:order.limitPrice-order.stopPrice},limits:{maxPositionPct:15,maxGrossPct:40,maxDailyLoss:100,maxSectorPct:25}};
  const result=researchToPaper({alignment:a,quote:observed?.quote??null,order,portfolio,marketAgeMs:observed?.ageMs??null,dataProvenance:validQuote?"verified_observation":"unverified"});
  return NextResponse.json({symbol,generatedAt:new Date().toISOString(),source:m?.provider||null,quoteTime:s?.quoteTimestamp||null,quoteVerifiedForSimulation:validQuote,decision:result,warning:"Research-only diagnostic with illustrative one-share risk assumptions. Quote recency alone does not establish official real-time entitlement or validated predictive performance."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",message:"Research assessment failed closed"},{status:503});}
}
