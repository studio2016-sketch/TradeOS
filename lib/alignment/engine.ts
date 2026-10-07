import {alignmentVariables,type AlignmentGroup} from "./registry";

export type VariableState="aligned"|"mixed"|"misaligned"|"unavailable";
export interface VariableReading{
  id:string;group:AlignmentGroup;label:string;weight:number;criticalBuy:boolean;hardSell:boolean;
  state:VariableState;buyScore:number|null;sellRisk:number|null;source:string;freshness:string;note:string;
}
export interface AlignmentResult{
  symbol:string;
  generatedAt:string;
  buyScore:number;
  sellScore:number;
  availability:number;
  alignedCount:number;
  mixedCount:number;
  misalignedCount:number;
  unavailableCount:number;
  criticalPassed:number;
  criticalTotal:number;
  hardSellTriggered:boolean;
  buyState:"NO TRADE"|"WATCH"|"READY"|"HIGH CONVICTION"|"MUST BUY";
  sellState:"HOLD"|"CAUTION"|"REDUCE"|"EXIT BIAS"|"MUST SELL";
  all100Aligned:boolean;
  readings:VariableReading[];
  groups:Array<{group:AlignmentGroup;buyScore:number;sellScore:number;available:number;aligned:number;total:number}>;
}

type Context={
  assessment?:any;
  regime?:any;
  market?:any;
  catalysts?:any;
  calibration?:any;
};

function stateFromScore(score:number|null):VariableState{
  if(score==null)return"unavailable";
  if(score>=85)return"aligned";
  if(score>=60)return"mixed";
  return"misaligned";
}

export function buildAlignment(symbol:string,ctx:Context):AlignmentResult{
  const assessment=ctx.assessment?.assessment;
  const sources=ctx.assessment?.sources??[];
  const marketSnap=ctx.market?.snapshots?.find((x:any)=>x.symbol===symbol);
  const marketReady=Boolean(marketSnap && ctx.market?.mode==="provider_data");
  const observedAssessment=ctx.assessment?.mode==="observed_market_data";
  const fredLive=ctx.regime?.mode==="official_daily";
  const secLive=ctx.catalysts?.mode==="live_authoritative";
  const calibrationReady=(ctx.calibration?.sampleCount??0)>=30;

  function scoreFor(label:string):[number|null,string,string,string]{
    if(label==="VIX condition" && fredLive){
      const v=Number(ctx.regime?.vix?.value);
      const s=Number.isFinite(v)?(v<18?90:v<24?72:v<32?45:20):null;
      return [s,"FRED VIXCLS","daily",`Latest official daily VIX: ${v}`];
    }
    if(label==="Yield environment" && fredLive){
      const y=Number(ctx.regime?.tenYear?.value);
      const s=Number.isFinite(y)?(y<4.5?82:y<5?68:y<5.5?52:35):null;
      return [s,"FRED DGS10","daily",`10Y Treasury: ${y}%`];
    }
    if(label==="Dollar risk tone" && fredLive){
      const d=ctx.regime?.broadDollar;
      const ch=Number(d?.changePct);
      const s=Number.isFinite(ch)?(ch<=-.25?88:ch<.10?72:ch<.35?55:35):null;
      return [s,"FRED DTWEXBGS","daily",`Broad dollar daily change: ${Number.isFinite(ch)?ch.toFixed(2)+"%":"unknown"}`];
    }
    if(label==="SEC filing significance" && secLive){
      const rows=ctx.catalysts?.catalysts??[];
      const has=rows.some((x:any)=>x.symbol===symbol);
      return [has?78:65,"SEC EDGAR","live authoritative",has?"Recent direct filing present":"No recent high-impact filing in current sample"];
    }
    if(["SPY trend direction","QQQ trend direction","IWM trend direction","Breadth participation"].includes(label) && observedAssessment){
      const map:Record<string,string>={"SPY trend direction":"SPY","QQQ trend direction":"QQQ","IWM trend direction":"IWM"};
      if(label==="Breadth participation") return [assessment?.agreement??null,"Observed assessment","intraday","Agreement proxy from stored market observations"];
      const s=(assessment?.direction==="bullish"?88:assessment?.direction==="bearish"?28:58);
      return [s,"Observed market data","intraday",`${map[label]} proxy inherits observed market direction`];
    }
    if(["Relative liquidity","Bid-ask spread quality","VWAP behavior","Execution slippage risk","Relative volume","Volume-confirmation persistence"].includes(label) && marketReady){
      const bid=Number(marketSnap.bid),ask=Number(marketSnap.ask),price=Number(marketSnap.price),vwap=Number(marketSnap.vwap);
      const spread=bid>0&&ask>0&&price>0?(ask-bid)/price:null;
      if(label==="Bid-ask spread quality"||label==="Execution slippage risk") return [spread==null?null:spread<.0008?95:spread<.0015?82:spread<.003?60:30,marketSnap.source,marketSnap.freshness,`Spread ${spread==null?"unknown":(spread*100).toFixed(3)+"%"}`];
      if(label==="VWAP behavior") return [Number.isFinite(vwap)&&vwap>0?(price>=vwap?88:38):null,marketSnap.source,marketSnap.freshness,`Price ${price}; VWAP ${vwap||"unknown"}`];
      if(label==="Relative liquidity") return [spread==null?75:spread<.002?90:55,marketSnap.source,marketSnap.freshness,"Liquidity proxy from current spread/quote"];
      return [null,"Market provider","pending feature","Requires rolling historical market observations"];
    }
    if(["News quality","News freshness","Catalyst interpretation confidence"].includes(label)){
      return [secLive?78:null,secLive?"SEC EDGAR":"none",secLive?"live":"unavailable",secLive?"Authoritative catalyst source available":"No authoritative catalyst source"];
    }
    if(label==="Headline-to-price reaction") return [null,"Reaction engine","waiting","Requires quote observations after catalyst time"];
    if(["Reward-to-risk ratio","Position-size compatibility","Stop-distance practicality","Clean invalidation level","Stop-order readiness","Profit-target readiness","Checklist completion","Daily-loss-limit status","Current open-risk status","Correlation exposure","Trade-count discipline","Tilt / emotional-risk check","Journal accountability","Broker / platform readiness"].includes(label)){
      return [null,"User / broker state","not connected","Requires trade ticket, account state, or user confirmation"];
    }
    if(calibrationReady && label==="Setup repeatability") return [Math.max(0,Math.min(100,(ctx.calibration?.confidenceMultiplier??.65)*100)),"TradeOS calibration","measured","Resolved-forecast calibration"];
    return [null,"Not yet observed","unavailable","Required input is not connected or not yet measured"];
  }

  const readings=alignmentVariables.map(def=>{
    const [buyScore,source,freshness,note]=scoreFor(def.label);
    const state=stateFromScore(buyScore);
    const sellRisk=buyScore==null?null:100-buyScore;
    return {...def,criticalBuy:Boolean(def.criticalBuy),hardSell:Boolean(def.hardSell),state,buyScore,sellRisk,source,freshness,note};
  });

  const available=readings.filter(r=>r.buyScore!=null);
  const weightTotal=available.reduce((s,r)=>s+r.weight,0)||1;
  const buyScore=available.reduce((s,r)=>s+(r.buyScore??0)*r.weight,0)/weightTotal;
  const sellScore=available.reduce((s,r)=>s+(r.sellRisk??0)*r.weight,0)/weightTotal;
  const critical=readings.filter(r=>r.criticalBuy);
  const criticalPassed=critical.filter(r=>r.state==="aligned").length;
  const hardSellTriggered=readings.some(r=>r.hardSell&&r.sellRisk!=null&&r.sellRisk>=90);
  const alignedCount=readings.filter(r=>r.state==="aligned").length;
  const mixedCount=readings.filter(r=>r.state==="mixed").length;
  const misalignedCount=readings.filter(r=>r.state==="misaligned").length;
  const unavailableCount=readings.filter(r=>r.state==="unavailable").length;
  const availability=available.length;

  const all100Aligned=alignedCount===100 && unavailableCount===0 && criticalPassed===critical.length;
  let buyState:AlignmentResult["buyState"]="NO TRADE";
  if(all100Aligned)buyState="MUST BUY";
  else if(availability>=80&&criticalPassed===critical.length&&buyScore>=92)buyState="HIGH CONVICTION";
  else if(availability>=65&&buyScore>=82)buyState="READY";
  else if(availability>=35&&buyScore>=68)buyState="WATCH";

  let sellState:AlignmentResult["sellState"]="HOLD";
  if(hardSellTriggered || (availability>=50&&sellScore>=90))sellState="MUST SELL";
  else if(availability>=40&&sellScore>=78)sellState="EXIT BIAS";
  else if(availability>=30&&sellScore>=65)sellState="REDUCE";
  else if(availability>=20&&sellScore>=50)sellState="CAUTION";

  const groupNames=[...new Set(readings.map(r=>r.group))];
  const groups=groupNames.map(group=>{
    const rs=readings.filter(r=>r.group===group), av=rs.filter(r=>r.buyScore!=null);
    const w=av.reduce((s,r)=>s+r.weight,0)||1;
    return {
      group,
      buyScore:av.length?+(av.reduce((s,r)=>s+(r.buyScore??0)*r.weight,0)/w).toFixed(1):0,
      sellScore:av.length?+(av.reduce((s,r)=>s+(r.sellRisk??0)*r.weight,0)/w).toFixed(1):0,
      available:av.length,aligned:rs.filter(r=>r.state==="aligned").length,total:rs.length
    };
  });

  return {
    symbol,generatedAt:new Date().toISOString(),
    buyScore:+buyScore.toFixed(1),sellScore:+sellScore.toFixed(1),availability,
    alignedCount,mixedCount,misalignedCount,unavailableCount,
    criticalPassed,criticalTotal:critical.length,hardSellTriggered,buyState,sellState,all100Aligned,
    readings,groups
  };
}
