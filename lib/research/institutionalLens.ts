export type InstitutionalDirection="bullish"|"bearish"|"mixed"|"neutral";
export interface InstitutionalPlaybook{
  id:string;
  label:string;
  score:number|null;
  direction:InstitutionalDirection;
  state:"strong"|"watch"|"weak"|"unavailable";
  evidence:string[];
  caveats:string[];
  predictiveTarget:"direction"|"magnitude"|"execution"|"risk";
  executionEligible:false;
}
export interface InstitutionalLens{
  symbol:string;
  generatedAt:string;
  observed:number;
  total:number;
  score:number;
  playbooks:InstitutionalPlaybook[];
  safety:{executionEligible:false;ordersAllowed:false;mode:"shadow-institutional-research"};
}

function clamp(n:number){return Math.max(0,Math.min(100,n))}
function avg(xs:Array<number|null|undefined>){
  const v=xs.filter((x):x is number=>Number.isFinite(Number(x))).map(Number);
  return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
}
function state(score:number|null){
  return score==null?"unavailable" as const:score>=80?"strong" as const:score>=55?"watch" as const:"weak" as const;
}
function directionalBias(score:number|null):InstitutionalDirection{\n  return score==null?"neutral":score>=68?"bullish":score<=38?"bearish":"mixed";\n}\nfunction pb(id:string,label:string,score:number|null,bias:InstitutionalDirection,target:InstitutionalPlaybook["predictiveTarget"],evidence:string[],caveats:string[]=[]):InstitutionalPlaybook{\n  const s=score==null?null:+clamp(score).toFixed(1);\n  return{id,label,score:s,direction:bias,state:state(s),predictiveTarget:target,evidence,caveats,executionEligible:false};\n}

export function evaluateInstitutionalLens(symbol:string,ctx:any):InstitutionalLens{
  const f=ctx.features,mc=ctx.marketContext,ms=ctx.microstructure,opt=ctx.options,nc=ctx.newsContext,nr=ctx.newsReaction;
  const readings=ctx.alignment?.readings??[];
  const read=(label:string)=>readings.find((r:any)=>r.label===label)?.buyScore??null;

  const vwap=avg([f?.structure?.anchoredVwapScore,f?.structure?.reclaimHoldScore,f?.structure?.confirmationScore,f?.intraday?.vwapHoldScore]);
  const breakout=avg([f?.intraday?.breakoutScore,f?.structure?.retestScore,f?.structure?.confirmationScore,f?.intraday?.breakoutVolumeScore]);
  const compression=avg([f?.intraday?.squeezeScore,f?.intraday?.volumeAcceleration,f?.intraday?.momentumPersistence]);
  const leadership=avg([mc?.sector?.relativeStrengthScore,f?.daily?.trendScore,f?.daily?.volumeRatio20==null?null:clamp(50+(Number(f.daily.volumeRatio20)-1)*35)]);
  const participation=avg([ms?.tapeAggressionScore,ms?.blockParticipationScore,f?.intraday?.accumulationScore]);
  const liquidity=avg([read("Relative liquidity"),read("Bid-ask spread quality"),read("Quote-depth quality"),f?.daily?.tradeability,opt?.liquidityScore]);
  const postEvent=avg([nr?.reactionScore,nc?.eventAsymmetryScore,nc?.sentimentScore,read("Catalyst recency")]);
  const crossAsset=avg([mc?.broad?.breadthScore,mc?.broad?.internalsScore,mc?.sector?.relativeStrengthScore,read("Credit-stress condition"),read("Yield-curve condition")]);
  const skew=opt?.putCallIvSkew==null?null:
    clamp(72-Math.min(50,Math.abs(Number(opt.putCallIvSkew))*180)+(opt?.liquidityScore==null?0:(Number(opt.liquidityScore)-50)*.2));
  const chase=avg([f?.structure?.chaseAvoidanceScore,f?.structure?.entryPrecisionScore,f?.structure?.triggerProximityScore,f?.structure?.rewardRiskScore]);

  const playbooks=[
    pb("vwap-acceptance","VWAP acceptance / reclaim",vwap,directionalBias(vwap),"direction",[
      `Anchored VWAP ${f?.structure?.anchoredVwapScore??"n/a"}`,
      `Reclaim/hold ${f?.structure?.reclaimHoldScore??"n/a"}`,
      `Confirmation ${f?.structure?.confirmationScore??"n/a"}`
    ],["VWAP is a reference, not intrinsic fair value."]),
    pb("breakout-acceptance","Breakout acceptance vs trap risk",breakout,directionalBias(breakout),"direction",[
      `Breakout quality ${f?.intraday?.breakoutScore??"n/a"}`,
      `Retest ${f?.structure?.retestScore??"n/a"}`,
      `Breakout volume ${f?.intraday?.breakoutVolumeScore??"n/a"}`
    ],["Failed breakouts can reverse quickly; confirmation matters more than the level alone."]),
    pb("compression-expansion","Volatility compression → expansion",compression,directionalBias(f?.intraday?.trendScore??null),"magnitude",[
      `Compression score ${f?.intraday?.squeezeScore??"n/a"}`,
      `Volume acceleration ${f?.intraday?.volumeAcceleration??"n/a"}`,
      `Momentum persistence ${f?.intraday?.momentumPersistence??"n/a"}`
    ],["Compression predicts potential expansion, not direction by itself."]),
    pb("relative-strength-leadership","Relative-strength leadership",leadership,directionalBias(mc?.sector?.relativeStrengthScore??null),"direction",[
      `Sector-relative strength ${mc?.sector?.relativeStrengthScore??"n/a"}`,
      `Daily trend ${f?.daily?.trendScore??"n/a"}`,
      `20-day symbol ROC ${mc?.sector?.symbolRoc20??"n/a"}%`
    ],["Leadership can mean strength or late-stage crowding; context is required."]),
    pb("institutional-participation-proxy","Institutional participation proxy",participation,directionalBias(participation),"direction",[
      `Tape aggression ${ms?.tapeAggressionScore??"n/a"}`,
      `Large-trade participation ${ms?.blockParticipationScore??"n/a"}`,
      `Accumulation proxy ${f?.intraday?.accumulationScore??"n/a"}`
    ],[ms?.feed==="iex"?"IEX-only proxy; not consolidated institutional order flow.":"Trade-size proxies do not identify investor identity."]),
    pb("liquidity-transaction-cost","Liquidity & transaction-cost quality",liquidity,"neutral","execution",[
      `Relative liquidity ${read("Relative liquidity")??"n/a"}`,
      `Spread quality ${read("Bid-ask spread quality")??"n/a"}`,
      `Quote depth ${read("Quote-depth quality")??"n/a"}`,
      `Options liquidity ${opt?.liquidityScore??"n/a"}`
    ],["Paper fills can look better than real fills; transaction costs must be stress-tested."]),
    pb("post-event-drift","Post-event drift / information digestion",postEvent,directionalBias(avg([nr?.reactionScore,nc?.sentimentScore])),"direction",[
      `Headline reaction ${nr?.reactionScore??"n/a"}`,
      `Event asymmetry ${nc?.eventAsymmetryScore??"n/a"}`,
      `Catalyst recency ${read("Catalyst recency")??"n/a"}`
    ],["A price move after news is context, not proof that the headline caused the move."]),
    pb("cross-asset-confirmation","Cross-asset & breadth confirmation",crossAsset,directionalBias(crossAsset),"direction",[
      `Breadth ${mc?.broad?.breadthScore??"n/a"}`,
      `Market internals ${mc?.broad?.internalsScore??"n/a"}`,
      `Credit stress ${read("Credit-stress condition")??"n/a"}`,
      `Yield curve ${read("Yield-curve condition")??"n/a"}`
    ],["Cross-asset relationships change by regime and should not be treated as permanent laws."]),
    pb("options-skew-stress","Options skew stress",skew,opt?.putCallIvSkew==null?"neutral":Number(opt.putCallIvSkew)>.08?"bearish":Number(opt.putCallIvSkew)<-.05?"bullish":"mixed","risk",[
      `Put-call IV skew ${opt?.putCallIvSkew??"n/a"}`,
      `ATM IV ${opt?.atmIv??"n/a"}`,
      `Expected 30d move ${opt?.expectedMovePct30d??"n/a"}%`
    ],[opt?.feed==="indicative"?"Indicative options feed; context only, not execution-quality positioning.":"Skew can reflect hedging demand rather than directional conviction."]),
    pb("chase-mean-reversion-risk","Chase / mean-reversion risk",chase,"neutral","risk",[
      `Chase avoidance ${f?.structure?.chaseAvoidanceScore??"n/a"}`,
      `Entry precision ${f?.structure?.entryPrecisionScore??"n/a"}`,
      `Trigger proximity ${f?.structure?.triggerProximityScore??"n/a"}`,
      `Reward/risk ${f?.structure?.rewardRiskScore??"n/a"}`
    ],["Strong trends can remain extended longer than mean-reversion models expect."])
  ];
  const observed=playbooks.filter(x=>x.score!=null);
  return{
    symbol,generatedAt:new Date().toISOString(),observed:observed.length,total:playbooks.length,
    score:+(avg(observed.map(x=>x.score))??0).toFixed(1),
    playbooks,
    safety:{executionEligible:false,ordersAllowed:false,mode:"shadow-institutional-research"}
  };
}
