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
  totalGears:number;
  observedCount:number;
  all108Aligned:boolean;
  all100Aligned:boolean; // legacy compatibility: now true only when all primary market gears align
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
  newsReaction?:any;
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
    if(label==="Credit-stress condition" && fredLive){
      const v=Number(ctx.regime?.highYieldSpread?.value);
      const s=Number.isFinite(v)?(v<3.5?90:v<4.5?75:v<6?52:28):null;
      return [s,"FRED BAMLH0A0HYM2","daily",Number.isFinite(v)?`High-yield spread ${v.toFixed(2)}%`:"High-yield spread unavailable"];
    }
    if(label==="Yield-curve condition" && fredLive){
      const v=Number(ctx.regime?.curve10y2y?.value);
      const s=Number.isFinite(v)?(v>=.25?88:v>=0?72:v>=-.5?50:30):null;
      return [s,"FRED T10Y2Y","daily",Number.isFinite(v)?`10Y-2Y curve ${v.toFixed(2)}%`:"Yield curve unavailable"];
    }
    if(label==="Quote freshness quality"){
      if(!marketSnap)return [null,"Market provider","unavailable","No current quote snapshot"];
      const age=Number(marketSnap.ageMs);
      const s=!Number.isFinite(age)?null:age<=15000?95:age<=60000?82:age<=300000?60:35;
      return [s,marketSnap.source,marketSnap.freshness,Number.isFinite(age)?`Quote age ${Math.round(age/1000)}s`:"Quote age unavailable"];
    }
    if(label==="Options skew condition" && ctx.options?.putCallIvSkew!=null){
      const skew=Math.abs(Number(ctx.options.putCallIvSkew));
      const s=skew<=.08?88:skew<=.16?74:skew<=.28?58:38;
      return [s,"Alpaca Options",ctx.options.feed,`Put-call IV skew ${Number(ctx.options.putCallIvSkew).toFixed(3)}`];
    }
    if(label==="Quote-depth quality" && marketReady){
      const bs=Number(marketSnap.bidSize),as=Number(marketSnap.askSize);
      const total=bs+as;
      const s=Number.isFinite(total)&&total>0?Math.max(35,Math.min(95,45+Math.log10(Math.max(1,total))*15)):null;
      return [s,marketSnap.source,marketSnap.freshness,total>0?`Displayed bid+ask size ${Math.round(total)}`:"Displayed quote depth unavailable"];
    }
    if(label==="Catalyst recency"){
      const rows=ctx.catalysts?.catalysts??[];
      const row=rows.find((x:any)=>x.symbol===symbol)??rows[0];
      if(!row)return [55,secLive?"SEC EDGAR":"Catalyst engine",secLive?"live authoritative":"unavailable","No recent material filing in the current catalyst window"];
      const raw=row.filedAt??row.filed_at??row.timestamp??row.date;
      const t=raw?new Date(raw).getTime():NaN;
      const ageH=Number.isFinite(t)?Math.max(0,(Date.now()-t)/36e5):null;
      const s=ageH==null?72:ageH<=24?92:ageH<=72?82:ageH<=168?68:55;
      return [s,"SEC EDGAR","live authoritative",ageH==null?"Recent catalyst present":`Latest catalyst age ${ageH.toFixed(1)}h`];
    }
    if(label==="Buying-power headroom" && ctx.brokerState){
      const eq=Number(ctx.brokerState.equity??0),bp=Number(ctx.brokerState.buyingPower??0);
      const ratio=eq>0?bp/eq:null;
      const s=ratio==null?null:ratio>=2?92:ratio>=1?82:ratio>=.5?68:45;
      return [s,"Alpaca Trading API","read-only",ratio==null?"Buying-power ratio unavailable":`Buying power is ${ratio.toFixed(2)}x equity`];
    }
    if(label==="Cash-reserve condition" && ctx.brokerState){
      const eq=Number(ctx.brokerState.equity??0),cash=Number(ctx.brokerState.cash??0);
      const ratio=eq>0?cash/eq:null;
      const s=ratio==null?null:ratio>=.5?92:ratio>=.25?82:ratio>=.1?68:45;
      return [s,"Alpaca Trading API","read-only",ratio==null?"Cash-reserve ratio unavailable":`Cash reserve ${(ratio*100).toFixed(1)}% of equity`];
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
    if(label==="Trade-count discipline"){
      if(ctx.processState?.tradeCountOk===true)return [95,"User Session Check","session-confirmed","User confirmed they are within their planned trade-count limit for this session."];
      if(ctx.processState?.tradeCountOk===false)return [20,"User Session Check","session-confirmed","User reported they are outside their planned trade-count limit; new risk should remain blocked."];
      return [null,"User Session Check","unconfirmed","Requires explicit session confirmation; TradeOS will not infer discipline from market data."];
    }
    if(label==="Tilt / emotional-risk check"){
      if(ctx.processState?.tiltOk===true)return [95,"User Session Check","session-confirmed","User confirmed they are calm and able to follow the trading plan."];
      if(ctx.processState?.tiltOk===false)return [15,"User Session Check","session-confirmed","User reported elevated emotional/tilt risk; new risk should remain blocked."];
      return [null,"User Session Check","unconfirmed","Requires explicit session confirmation; TradeOS will not infer emotional state."];
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
      const bs=ctx.brokerState;
      const accountOk=bs.accountStatus==="ACTIVE"&&!bs.tradingBlocked&&!bs.accountBlocked&&!bs.tradeSuspendedByUser;
      if(label==="Broker / platform readiness"){
        return [accountOk?95:25,"Alpaca Trading API","read-only",accountOk?"Paper account reports active/readable and not blocked. No order-writing path is enabled.":"Account reports a blocking/suspension condition."];
      }
      if(label==="Current open-risk status"){
        const exposure=(bs.positions??[]).reduce((s:number,p:any)=>s+Math.abs(Number(p.marketValue??0)),0);
        const equity=Number(bs.equity??0);
        const pct=equity>0?exposure/equity*100:null;
        const score=pct==null?null:pct===0?98:pct<=25?92:pct<=50?80:pct<=80?65:pct<=100?50:30;
        return [score,"Alpaca Trading API","read-only",pct==null?"Equity unavailable":`Gross paper exposure ${pct.toFixed(1)}% across ${(bs.positions??[]).length} position(s).`];
      }
      if(label==="Correlation exposure"){
        const count=(bs.positions??[]).length;
        const score=count===0?98:count===1?88:70;
        return [score,"Alpaca Trading API","read-only",count===0?"No open paper positions; portfolio correlation exposure is currently zero.":`${count} open paper position(s); detailed cross-position correlation requires holdings analysis.`];
      }
      if(label==="Position-size compatibility"){
        const equity=Number(bs.equity??0),bp=Number(bs.buyingPower??0);
        const geom=Number(ctx.features?.structure?.stopDistanceScore??NaN);
        const score=!accountOk||!(equity>0)||!(bp>0)?25:Number.isFinite(geom)?Math.max(55,Math.min(95,.55*geom+42)):75;
        return [score,"Alpaca Paper + TradeOS Risk Geometry","read-only/derived",`Paper equity ${equity.toFixed(0)}, buying power ${bp.toFixed(0)}. Compatibility reflects account capacity and chart-defined stop practicality, not an authorized position size.`];
      }
      if(label==="Stop-order readiness"){
        const geom=Number(ctx.features?.structure?.cleanInvalidationScore??NaN);
        const score=accountOk&&Number.isFinite(geom)?Math.min(80,Math.max(55,geom)):null;
        return [score,"Alpaca Paper + TradeOS Risk Geometry","read-only/derived",score==null?"Stop geometry unavailable":"Broker is readable and an invalidation level exists, but no order is placed and user confirmation remains required."];
      }
      if(label==="Daily-loss-limit status"){
        const eq=Number(bs.equity??0),last=Number(bs.lastEquity??0);
        if(eq>0&&last>0){
          const pnlPct=(eq-last)/last*100;
          const score=pnlPct>=0?80:pnlPct>-0.5?72:pnlPct>-1?60:45;
          return [score,"Alpaca Trading API","read-only",`Paper account day change ${pnlPct.toFixed(2)}%. A user-defined daily loss ceiling is not configured, so this gate cannot be fully aligned.`];
        }
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
    if(["Trade-count discipline","Tilt / emotional-risk check"].includes(label)){
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
  const observedCount=available.length;
  const availability=readings.length?+(observedCount/readings.length*100).toFixed(1):0;

  const all108Aligned=alignedCount===readings.length && readings.length===108 && unavailableCount===0 && criticalPassed===critical.length;
  const all100Aligned=all108Aligned;
  let buyState:AlignmentResult["buyState"]="NO TRADE";
  if(all108Aligned)buyState="MUST BUY";
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
    criticalPassed,criticalTotal:critical.length,hardSellTriggered,buyState,sellState,
    totalGears:readings.length,observedCount,all108Aligned,all100Aligned,
    readings,groups
  };
}
