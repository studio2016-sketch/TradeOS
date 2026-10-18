import {NextResponse} from "next/server";
import {historicalBars} from "../../../lib/market/features";
import {simulateLongAfterDecision} from "../../../lib/research/replaySimulator";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const q=new URL(req.url).searchParams;
 const symbol=(q.get("symbol")||"SPY").toUpperCase().trim();
 const decisionAt=q.get("decisionAt")||"";
 const ms=Date.parse(decisionAt);
 if(!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)||!Number.isFinite(ms)||ms>Date.now()-10*60000||ms<Date.parse("2000-01-01"))return NextResponse.json({error:"Select a valid ticker and a past decision time at least ten minutes ago."},{status:400});
 const read=(k:string,d:number)=>q.has(k)?Number(q.get(k)):d;
 const horizon=read("bars",20);
 const params={decisionAt:new Date(ms).toISOString(),symbol,startingEquity:read("equity",10000),riskBudget:read("risk",50),stopPct:read("stopPct",1),targetPct:read("targetPct",2),slippageBps:read("slippageBps",10),commissionPerShare:read("commission",0),maxBars:horizon};
 if(horizon<1||horizon>500||params.slippageBps<0||params.slippageBps>1000||params.startingEquity<=0||params.riskBudget<=0)return NextResponse.json({error:"Invalid simulation risk, equity, slippage or horizon inputs."},{status:400});
 try{
  const feed=process.env.ALPACA_FEED||"iex";
  const end=new Date(Math.min(Date.now()-16*60000,ms+Math.max(1,horizon)*5*60000+48*3600000)).toISOString();
  const history=await historicalBars(symbol,"5Min",new Date(ms-60*60000).toISOString(),1000,feed,end);
  const output=simulateLongAfterDecision(history,params);
  return NextResponse.json({simulation:output,source:"Alpaca:"+feed,marketHistoryLatestAt:history.at(-1)?.t??null,certification:"RESEARCH_ONLY",limitations:["Uses historical prices only; signal integrity must be separately established as-of decision time.","The simulation assumes a long market order at next available bar open with synthetic slippage and commission assumptions.","Cannot be used to claim cost-adjusted profitability or a production strategy win rate."]},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({mode:"UNAVAILABLE",reason:"Recorded prices unavailable"},{status:503})}
}
