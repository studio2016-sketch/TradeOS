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
  options?:any;
  macro?:any;
  features?:any;
  marketContext?:any;
  newsContext?:any;
  reactions?:any[];
  microstructure?:any;
  issuer?:any;
  brokerState?:any;
  processState?:any;
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
    const mc=ctx.marketContext;
    if(mc){
      const marketMap:Record<string,any>={
        "SPY trend direction":mc.broad?.SPY,
        "QQQ trend direction":mc.broad?.QQQ,
        "IWM trend direction":mc.broad?.IWM,
        "Breadth participation":mc.broad?.breadthScore,
        "Sector relative strength":mc.sector?.relativeStrengthScore,
        "Market correlation":mc.correlation?.score,
        "Market session condition":mc.session?.score,
        "Market-internals confirmation":mc.broad?.internalsScore,
        "Relative strength vs peers":mc.sector?.relativeStrengthScore
      };
      if(Object.prototype.hasOwnProperty.call(marketMap,label)){
        const s=Number.isFinite(Number(marketMap[label]))?Number(marketMap[label]):null;
        const note=label==="Sector relative strength"||label==="Relative strength vs peers"
          ? `vs ${mc.sector?.proxy??"sector proxy"}; symbol ROC20 ${mc.sector?.symbolRoc20??"n/a"}%, sector ${mc.sector?.sectorRoc20??"n/a"}%`
          : label==="Market correlation"
            ? `20-day SPY correlation ${mc.correlation?.spy20==null?"n/a":Number(mc.correlation.spy20).toFixed(2)}`
            : label==="Market session condition"
              ? mc.session?.note
              : "Derived from broad-market historical context";
        return [s,"Alpaca Market Context","historical/context",note];
      }
    }
    const f=ctx.features;
    if(f){
      const histSource=`Alpaca Historical:${f.feed}`;
      const num=(x:any)=>Number.isFinite(Number(x))?Number(x):null;
      const trendMap:Record<string,any>={
        "Daily trend alignment":f.daily?.trendScore,
        "4-hour trend alignment":f.hourly?.trendScore,
        "1-hour trend alignment":f.hourly?.trendScore,
        "15-minute trend alignment":f.intraday?.trendScore,
        "5-minute trend alignment":f.intraday?.trendScore,
        "Trend durability":f.daily?.trendScore,
        "Moving-average stack":f.daily?.trendScore,
        "Moving-average slope":f.daily?.trendScore,
        "Higher-high / higher-low structure":f.hourly?.trendScore,
        "Rate of change":f.intraday?.rocPct==null?null:Math.max(0,Math.min(100,50+f.intraday.rocPct*8)),
        "RSI quality":f.intraday?.rsi14==null?null:(f.intraday.rsi14>=50&&f.intraday.rsi14<=72?88:f.intraday.rsi14>=40&&f.intraday.rsi14<80?68:42),
        "MACD quality":f.intraday?.macdScore,
        "Price acceleration":f.intraday?.priceAcceleration,
        "Momentum persistence":f.intraday?.momentumPersistence,
        "Squeeze release":f.intraday?.squeezeScore,
        "VWAP behavior":f.intraday?.vwapHoldScore,
        "Opening-range behavior":f.intraday?.openingRangeScore,
        "Breakout quality":f.intraday?.breakoutScore,
        "Breakout force":f.intraday?.breakoutScore,
        "Follow-through strength":f.intraday?.momentumPersistence,
        "Volume acceleration":f.intraday?.volumeAcceleration,
        "Breakout-level volume":f.intraday?.breakoutVolumeScore,
        "Accumulation behavior":f.intraday?.accumulationScore,
        "Volume-confirmation persistence":f.intraday?.breakoutVolumeScore,
        "Intraday range condition":f.intraday?.rangeConditionScore,
        "Support / resistance clarity":f.intraday?.supportDistancePct==null||f.intraday?.resistanceDistancePct==null?null:Math.max(0,Math.min(100,80-Math.min(50,Math.abs(f.intraday.supportDistancePct)+Math.abs(f.intraday.resistanceDistancePct)))),
        "ATR suitability":f.daily?.atr14Pct==null?null:(f.daily.atr14Pct<=2?78:f.daily.atr14Pct<=4?88:f.daily.atr14Pct<=7?68:42),
        "Realized volatility regime":f.daily?.realizedVol20Pct==null?null:(f.daily.realizedVol20Pct<=25?85:f.daily.realizedVol20Pct<=45?75:f.daily.realizedVol20Pct<=70?58:38),
        "Volatility expansion / compression":f.intraday?.squeezeScore,
        "Relative volume":f.daily?.volumeRatio20==null?null:Math.max(0,Math.min(100,50+(f.daily.volumeRatio20-1)*35)),
        "Average daily volume":f.daily?.avgVolume20==null?null:(f.daily.avgVolume20>=1e7?95:f.daily.avgVolume20>=3e6?85:f.daily.avgVolume20>=1e6?72:f.daily.avgVolume20>=3e5?55:35),
        "Chart cleanliness":f.daily?.chartCleanliness,
        "Tradeability score":f.daily?.tradeability,
        "Trend-continuation quality":f.daily?.trendScore==null||f.intraday?.trendScore==null?null:(f.daily.trendScore*.55+f.intraday.trendScore*.45),
        "Setup repeatability":f.quality?.coverageScore,
        "Anchored VWAP alignment":f.structure?.anchoredVwapScore,
        "Stop-distance practicality":f.structure?.stopDistanceScore,
        "Reward-to-risk ratio":f.structure?.rewardRiskScore,
        "Loss-containment potential":f.structure?.lossContainmentScore,
        "Absorption / exhaustion":f.structure?.absorptionScore,
        "Opening-auction quality":f.structure?.openingAuctionScore,
        "Pullback quality":f.structure?.pullbackScore,
        "Base quality":f.structure?.baseScore,
        "Reversal-pattern quality":f.structure?.reversalScore,
        "Confluence count":f.structure?.confluenceScore,
        "Failed-move trap risk":f.structure?.failedMoveRiskScore,
        "Clean invalidation level":f.structure?.cleanInvalidationScore,
        "Time-of-day edge":f.structure?.timeOfDayScore,
        "Confirmation-candle close":f.structure?.confirmationScore,
        "Reclaim / hold behavior":f.structure?.reclaimHoldScore,
        "Retest success":f.structure?.retestScore,
        "Trigger proximity":f.structure?.triggerProximityScore,
        "Chase-avoidance condition":f.structure?.chaseAvoidanceScore,
        "Entry precision":f.structure?.entryPrecisionScore
      };
      if(Object.prototype.hasOwnProperty.call(trendMap,label)){
        const s=num(trendMap[label]);
        return [s,histSource,"historical",s==null?"Insufficient historical sample":`Derived from ${f.quality?.barCount??0} historical bars`];
      }
    }
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
    if(label==="Economic event risk" && ctx.macro?.score!=null){
      return [Number(ctx.macro.score),"BLS release calendar","scheduled",ctx.macro.next?`Next macro release: ${ctx.macro.next.summary} ${ctx.macro.next.date} ${ctx.macro.next.time??""}`:"No near-term major BLS release found"];
    }
    if(label==="Dollar risk tone" && fredLive){
      const d=ctx.regime?.broadDollar;
      const ch=Number(d?.changePct);
      const s=Number.isFinite(ch)?(ch<=-.25?88:ch<.10?72:ch<.35?55:35):null;
      return [s,"FRED DTWEXBGS","daily",`Broad dollar daily change: ${Number.isFinite(ch)?ch.toFixed(2)+"%":"unknown"}`];
    }
    if(ctx.newsContext){
      const newsMap:Record<string,any>={
        "Earnings / guidance relevance":ctx.newsContext.earningsScore,
        "Analyst revision pressure":ctx.newsContext.analystRevisionScore,
        "Sector narrative strength":ctx.newsContext.sectorNarrativeScore,
        "Sentiment condition":ctx.newsContext.sentimentScore,
        "Event asymmetry":ctx.newsContext.eventAsymmetryScore
      };
      if(Object.prototype.hasOwnProperty.call(newsMap,label)){
        const s=Number.isFinite(Number(newsMap[label]))?Number(newsMap[label]):null;
        return [s,"Provider News Context","recent",ctx.newsContext.note??"Deterministic provider-news context"];
      }
    }
    if(label==="Headline-to-price reaction"){
      const rows=ctx.reactions??[];
      if(rows.length){
        const r=rows[0],mag=Number(r.reactionScore??0),ret=Number(r.returnPct??0);
        const s=Math.max(0,Math.min(100,ret>=0?50+mag/2:50-mag/2));
        return [s,"Observed Catalyst Reaction","measured",`${r.classification}; return ${ret}% over ${r.observedMinutes}m`];
      }
      if(ctx.newsReaction?.reactionScore!=null){
        return [Number(ctx.newsReaction.reactionScore),"Provider News Reaction","historical/context",ctx.newsReaction.note];
      }
      return [null,"Reaction engine","waiting","Requires measurable price history surrounding a recent catalyst or headline"];
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
    if(label==="Options liquidity" && ctx.options?.liquidityScore!=null){
      return [Number(ctx.options.liquidityScore),"Alpaca Options",ctx.options.feed,ctx.options.note];
    }
    if(label==="Expected-move context" && ctx.options?.volatilitySuitability!=null){
      return [Number(ctx.options.volatilitySuitability),"Alpaca Options",ctx.options.feed,`30-day implied expected move: ${ctx.options.expectedMovePct30d}%`];
    }
    if(label==="Volatility usability" && ctx.options?.volatilitySuitability!=null){
      return [Number(ctx.options.volatilitySuitability),"Alpaca Options",ctx.options.feed,`ATM IV: ${ctx.options.atmIv??"unknown"}`];
    }
    if(label==="Gap risk" && ctx.options?.expectedMovePct30d!=null){
      const m=Number(ctx.options.expectedMovePct30d);
      const s=m<=6?85:m<=10?72:m<=16?55:35;
      return [s,"Alpaca Options",ctx.options.feed,`Implied 30-day move: ${m}%`];
    }
    if(label==="Profit-target readiness" && ctx.features?.structure?.rewardRiskScore!=null){
      return [Number(ctx.features.structure.rewardRiskScore),"TradeOS Risk Geometry","derived","Target readiness is derived from chart-defined reward-to-risk geometry; no order is placed."];
    }
    if(label==="Checklist completion"){
      const observedFraction=alignmentVariables.length?alignmentVariables.filter(def=>def.label!==label).length:99;
      const connectedCore=Boolean(ctx.features&&ctx.marketContext&&ctx.regime&&ctx.catalysts);
      const score=connectedCore?88:55;
      return [score,"TradeOS Process","system",connectedCore?"Core data/checklist inputs are present; personal-account gates remain separate.":"Core checklist inputs are incomplete."];
    }
    if(label==="Journal accountability"){
      return [92,"TradeOS Audit Ledger","system","Forecasts, outcomes, governed alignment snapshots, and source provenance are persisted for accountability."];
    }
    if(ctx.brokerState){
      if(label==="Broker / platform readiness"){
        const ok=ctx.brokerState.accountStatus==="ACTIVE"&&!ctx.brokerState.tradingBlocked&&!ctx.brokerState.accountBlocked&&!ctx.brokerState.tradeSuspendedByUser;
        return [ok?95:25,"Alpaca Trading API","read-only",ok?"Account reports active/readable and not blocked. No order-writing path is enabled.":"Account reports a blocking/suspension condition."];
      }
    }
    if(ctx.issuer){
      if(label==="Float structure" && ctx.issuer.floatStructureScore!=null){
        return [Number(ctx.issuer.floatStructureScore),"SEC Company Facts","authoritative",ctx.issuer.note];
      }
      if(label==="Institutional participation" && ctx.issuer.institutionalParticipationScore!=null){
        return [Number(ctx.issuer.institutionalParticipationScore),"SEC 13D/13G Activity","authoritative proxy",ctx.issuer.note];
      }
    }
    if(ctx.microstructure){
      if(label==="Tape aggression" && ctx.microstructure.tapeAggressionScore!=null){
        return [Number(ctx.microstructure.tapeAggressionScore),"Alpaca Recent Trades",ctx.microstructure.feed,ctx.microstructure.note];
      }
      if(label==="Block participation" && ctx.microstructure.blockParticipationScore!=null){
        return [Number(ctx.microstructure.blockParticipationScore),"Alpaca Recent Trades",ctx.microstructure.feed,ctx.microstructure.note];
      }
    }
    if(label==="Bid-ask imbalance" && marketReady){
      const bs=Number(marketSnap.bidSize),as=Number(marketSnap.askSize);
      const total=bs+as;
      const imb=total>0?(bs-as)/total:null;
      const s=imb==null?null:Math.max(0,Math.min(100,50+imb*45));
      return [s,marketSnap.source,marketSnap.freshness,imb==null?"Quote sizes unavailable":`Bid/ask size imbalance ${(imb*100).toFixed(1)}%`];
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
    if(["Position-size compatibility","Stop-order readiness","Daily-loss-limit status","Current open-risk status","Correlation exposure","Trade-count discipline","Tilt / emotional-risk check","Broker / platform readiness"].includes(label)){
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
