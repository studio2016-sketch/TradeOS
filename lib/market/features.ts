export interface Bar{t:string;o:number;h:number;l:number;c:number;v:number;vw?:number;n?:number}
export interface FeatureSet{
  symbol:string;feed:string;generatedAt:string;
  daily:{trendScore:number|null;ema20:number|null;ema50:number|null;atr14Pct:number|null;roc20Pct:number|null;volumeRatio20:number|null;avgVolume20:number|null;realizedVol20Pct:number|null;chartCleanliness:number|null;tradeability:number|null};
  hourly:{trendScore:number|null;rocPct:number|null};
  intraday:{trendScore:number|null;rocPct:number|null;rsi14:number|null;macdScore:number|null;priceAcceleration:number|null;momentumPersistence:number|null;squeezeScore:number|null;vwapHoldScore:number|null;openingRangeScore:number|null;breakoutScore:number|null;breakoutVolumeScore:number|null;volumeAcceleration:number|null;accumulationScore:number|null;rangeConditionScore:number|null;supportDistancePct:number|null;resistanceDistancePct:number|null};
  structure:{
    anchoredVwapScore:number|null;sessionVwap:number|null;stopDistanceScore:number|null;rewardRiskScore:number|null;rewardRiskRatio:number|null;lossContainmentScore:number|null;
    absorptionScore:number|null;openingAuctionScore:number|null;pullbackScore:number|null;baseScore:number|null;reversalScore:number|null;confluenceScore:number|null;
    failedMoveRiskScore:number|null;cleanInvalidationScore:number|null;timeOfDayScore:number|null;confirmationScore:number|null;reclaimHoldScore:number|null;
    retestScore:number|null;triggerProximityScore:number|null;chaseAvoidanceScore:number|null;entryPrecisionScore:number|null
  };
  quality:{barCount:number;coverageScore:number;note:string};
}
function ema(xs:number[],p:number){if(xs.length<p)return null;const k=2/(p+1);let e=xs.slice(0,p).reduce((a,b)=>a+b,0)/p;for(const x of xs.slice(p))e=x*k+e*(1-k);return e}
function sma(xs:number[],p:number){return xs.length<p?null:xs.slice(-p).reduce((a,b)=>a+b,0)/p}
function rsi(xs:number[],p=14){if(xs.length<=p)return null;let g=0,l=0;for(let i=xs.length-p;i<xs.length;i++){const d=xs[i]-xs[i-1];if(d>=0)g+=d;else l-=d}if(l===0)return 100;const rs=(g/p)/(l/p);return 100-100/(1+rs)}
function atr(b:Bar[],p=14){if(b.length<=p)return null;const tr=b.slice(1).map((x,i)=>Math.max(x.h-x.l,Math.abs(x.h-b[i].c),Math.abs(x.l-b[i].c)));return sma(tr,p)}
function stdev(xs:number[]){if(xs.length<2)return null;const m=xs.reduce((a,b)=>a+b,0)/xs.length;return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))}
function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,n))}
export async function historicalBars(symbol:string,timeframe:string,start:string,limit=1000):Promise<Bar[]>{
  const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;
  if(!key||!secret)return[];
  const feed=process.env.ALPACA_FEED||"iex";
  const url=new URL(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars`);
  url.searchParams.set("timeframe",timeframe);url.searchParams.set("start",start);url.searchParams.set("limit",String(limit));url.searchParams.set("feed",feed);url.searchParams.set("adjustment","all");url.searchParams.set("sort","asc");
  const res=await fetch(url,{headers:{"APCA-API-KEY-ID":key,"APCA-API-SECRET-KEY":secret},cache:"no-store"});
  if(!res.ok)throw new Error(`Alpaca ${timeframe} bars HTTP ${res.status}`);
  const j=await res.json() as any; return j.bars??[];
}
function trendScore(b:Bar[],fast=9,slow=20){
  const c=b.map(x=>x.c),f=ema(c,fast),s=ema(c,slow);if(f==null||s==null)return null;
  const last=c[c.length-1],slope=c.length>slow+5?(s-(ema(c.slice(0,-5),slow)??s))/s:0;
  return clamp(50+(last>s?18:-18)+(f>s?18:-18)+Math.max(-14,Math.min(14,slope*1000)));
}
function roc(b:Bar[],lookback:number){if(b.length<=lookback)return null;const a=b[b.length-lookback-1].c,z=b[b.length-1].c;return a?((z-a)/a)*100:null}
function intradayFeatures(b:Bar[]){
  if(b.length<10)return {trendScore:null,rocPct:null,rsi14:null,macdScore:null,priceAcceleration:null,momentumPersistence:null,squeezeScore:null,vwapHoldScore:null,openingRangeScore:null,breakoutScore:null,breakoutVolumeScore:null,volumeAcceleration:null,accumulationScore:null,rangeConditionScore:null,supportDistancePct:null,resistanceDistancePct:null};
  const c=b.map(x=>x.c),vol=b.map(x=>x.v),last=b[b.length-1];
  const vwaps=b.map(x=>x.vw).filter((x):x is number=>x!=null);
  const vwap=vwaps.length?vwaps[vwaps.length-1]:null;
  const vwapHold=vwap==null?null:clamp(last.c>=vwap?82+(last.c-vwap)/last.c*800:45-(vwap-last.c)/last.c*800);
  const today=b.filter(x=>new Date(x.t).toISOString().slice(0,10)===new Date(last.t).toISOString().slice(0,10));
  const open=today.slice(0,6); const orHigh=open.length?Math.max(...open.map(x=>x.h)):null,orLow=open.length?Math.min(...open.map(x=>x.l)):null;
  const openingRangeScore=orHigh==null?null:clamp(last.c>orHigh?90:last.c<orLow! ?25:60);
  const prev=b.slice(Math.max(0,b.length-21),-1);const ph=prev.length?Math.max(...prev.map(x=>x.h)):null,pl=prev.length?Math.min(...prev.map(x=>x.l)):null;
  const breakout=ph==null?null:clamp(last.c>ph?92:last.c<pl! ?25:58);
  const short=sma(vol,5),long=sma(vol,20);const volumeAcceleration=short&&long?clamp(50+(short/long-1)*45):null;
  const support=pl,resistance=ph;
  const e12=ema(c,12),e26=ema(c,26),macdScore=e12==null||e26==null?null:clamp(50+(e12-e26)/last.c*1200);
  const r6=roc(b,6),r12=roc(b,12),priceAcceleration=r6==null||r12==null?null:clamp(50+(r6-r12/2)*10);
  const changes=c.slice(-13).map((x,i,a)=>i?x-a[i-1]:0).slice(1),up=changes.filter(x=>x>0).length,down=changes.filter(x=>x<0).length;
  const momentumPersistence=changes.length?clamp(50+(up-down)/changes.length*45):null;
  const recentRanges=b.slice(-20).map(x=>(x.h-x.l)/x.c*100),rangeAvg=sma(recentRanges,20),range5=sma(recentRanges,5);
  const squeezeScore=rangeAvg&&range5?clamp(70-(range5/rangeAvg-1)*70):null;
  const breakoutVolumeScore=short&&long?clamp(50+(short/long-1)*50):null;
  const recent=b.slice(-20),signedVol=recent.reduce((s,x,i)=>i?s+(x.c>=recent[i-1].c?x.v:-x.v):0,0),totVol=recent.reduce((s,x)=>s+x.v,0);
  const accumulationScore=totVol?clamp(50+signedVol/totVol*45):null;
  const rangeConditionScore=rangeAvg==null?null:(rangeAvg<=.35?55:rangeAvg<=1.2?88:rangeAvg<=2.5?72:45);
  return{trendScore:trendScore(b),rocPct:roc(b,12),rsi14:rsi(c),macdScore,priceAcceleration,momentumPersistence,squeezeScore,vwapHoldScore:vwapHold,openingRangeScore,breakoutScore:breakout,breakoutVolumeScore,volumeAcceleration,accumulationScore,rangeConditionScore,supportDistancePct:support?((last.c-support)/last.c)*100:null,resistanceDistancePct:resistance?((resistance-last.c)/last.c)*100:null};
}
function currentEtMinutes(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const get=(t:string)=>parts.find(p=>p.type===t)?.value||"";
  return{weekday:get("weekday"),minutes:Number(get("hour"))*60+Number(get("minute"))};
}
function structureFeatures(intra:Bar[],daily:Bar[],intr:any){
  if(intra.length<20)return{
    anchoredVwapScore:null,sessionVwap:null,stopDistanceScore:null,rewardRiskScore:null,rewardRiskRatio:null,lossContainmentScore:null,
    absorptionScore:null,openingAuctionScore:null,pullbackScore:null,baseScore:null,reversalScore:null,confluenceScore:null,failedMoveRiskScore:null,
    cleanInvalidationScore:null,timeOfDayScore:null,confirmationScore:null,reclaimHoldScore:null,retestScore:null,triggerProximityScore:null,chaseAvoidanceScore:null,entryPrecisionScore:null
  };
  const last=intra[intra.length-1],todayDate=new Date(last.t).toISOString().slice(0,10);
  const today=intra.filter(x=>new Date(x.t).toISOString().slice(0,10)===todayDate);
  const session=today.length?today:intra.slice(-78);
  const vol=session.reduce((s,x)=>s+x.v,0);
  const pv=session.reduce((s,x)=>s+((x.vw??((x.h+x.l+x.c)/3))*x.v),0);
  const sessionVwap=vol?pv/vol:null;
  const anchoredVwapScore=sessionVwap==null?null:clamp(last.c>=sessionVwap?82+(last.c-sessionVwap)/last.c*700:45-(sessionVwap-last.c)/last.c*700);

  const atrPct=atr(daily,14)&&daily[daily.length-1]?.c?(atr(daily,14)!/daily[daily.length-1].c)*100:null;
  const supportDist=Math.abs(Number(intr.supportDistancePct??NaN));
  const resistanceDist=Number(intr.resistanceDistancePct??NaN);
  const stopAtr=atrPct&&Number.isFinite(supportDist)?supportDist/atrPct:null;
  const stopDistanceScore=stopAtr==null?null:stopAtr>=.25&&stopAtr<=1.2?90:stopAtr<=1.8?70:stopAtr<.15?52:38;
  const rr=Number.isFinite(supportDist)&&supportDist>.05&&Number.isFinite(resistanceDist)&&resistanceDist>0?resistanceDist/supportDist:null;
  const rewardRiskScore=rr==null?null:rr>=2.5?95:rr>=2?86:rr>=1.5?72:rr>=1?55:30;
  const lossContainmentScore=stopDistanceScore==null||atrPct==null?null:clamp(.7*stopDistanceScore+.3*(atrPct<=4?88:atrPct<=7?62:38));

  const recent=intra.slice(-20),prev=intra.slice(-40,-20);
  const recentRange=recent.length?(Math.max(...recent.map(x=>x.h))-Math.min(...recent.map(x=>x.l)))/last.c*100:null;
  const prevRange=prev.length?(Math.max(...prev.map(x=>x.h))-Math.min(...prev.map(x=>x.l)))/last.c*100:null;
  const baseScore=recentRange==null||prevRange==null||prevRange===0?null:clamp(75-(recentRange/prevRange-0.65)*65);

  const last3=recent.slice(-3),prevBar=recent[recent.length-2],lastBar=recent[recent.length-1];
  const reversalScore=!prevBar||!lastBar?null:
    (lastBar.c>lastBar.o&&prevBar.c<prevBar.o&&lastBar.c>=prevBar.o&&lastBar.o<=prevBar.c)?92:
    (lastBar.c>prevBar.h?78:lastBar.c<prevBar.l?30:55);

  const signedVol=recent.reduce((s,x,i)=>i?s+(x.c>=recent[i-1].c?x.v:-x.v):0,0);
  const rangeMove=recent.length>1?Math.abs(recent[recent.length-1].c-recent[0].c)/last.c*100:0;
  const totalRecentVol=recent.reduce((s,x)=>s+x.v,0);
  const flowBias=totalRecentVol?Math.abs(signedVol)/totalRecentVol:0;
  const absorptionScore=clamp(45+(flowBias>.35&&rangeMove<.5?35:flowBias>.2?18:0));

  const open=session.slice(0,6),next=session.slice(6,12);
  const openVol=open.reduce((s,x)=>s+x.v,0),nextVol=next.reduce((s,x)=>s+x.v,0);
  const openDir=open.length>1?(open[open.length-1].c-open[0].o)/open[0].o:0;
  const openingAuctionScore=!open.length?null:clamp(55+(nextVol?Math.min(25,(openVol/Math.max(nextVol,1)-1)*18):10)+Math.min(20,Math.abs(openDir)*1000));

  const trend=trendScore(daily,20,50),vwap=anchoredVwapScore;
  const pullbackScore=trend==null||vwap==null?null:clamp((trend*.55)+(vwap>=55&&vwap<=88?35:vwap>88?25:10));

  const confirms=[intr.trendScore,intr.vwapHoldScore,intr.breakoutScore,intr.breakoutVolumeScore,intr.momentumPersistence,anchoredVwapScore]
    .filter((x):x is number=>x!=null);
  const confluenceScore=confirms.length?clamp(confirms.filter(x=>x>=70).length/confirms.length*100):null;
  const failedMoveRiskScore=intr.breakoutScore==null||intr.momentumPersistence==null?null:clamp(.55*intr.breakoutScore+.45*intr.momentumPersistence);
  const cleanInvalidationScore=stopDistanceScore;

  const et=currentEtMinutes();
  const timeOfDayScore=["Sat","Sun"].includes(et.weekday)?25:
    et.minutes>=585&&et.minutes<=690?90:
    et.minutes>=840&&et.minutes<=945?82:
    et.minutes>=570&&et.minutes<960?65:
    et.minutes>=240&&et.minutes<570?45:40;

  const aboveSessionVwap=sessionVwap!=null?last3.filter(x=>x.c>=sessionVwap).length:null;
  const confirmationScore=aboveSessionVwap==null?null:clamp(45+(aboveSessionVwap/Math.max(1,last3.length))*50);
  const last8=recent.slice(-8);
  const hadBelow=sessionVwap!=null&&last8.some(x=>x.c<sessionVwap);
  const last3Above=sessionVwap!=null&&last3.length>=2&&last3.every(x=>x.c>=sessionVwap);
  const reclaimHoldScore=sessionVwap==null?null:hadBelow&&last3Above?92:last3Above?76:38;

  const prev20=intra.slice(-41,-1),priorHigh=prev20.length?Math.max(...prev20.map(x=>x.h)):null;
  const broke=priorHigh!=null&&recent.some(x=>x.c>priorHigh);
  const retested=priorHigh!=null&&recent.slice(-8).some(x=>Math.abs(x.l-priorHigh)/priorHigh<=.003&&x.c>=priorHigh);
  const retestScore=priorHigh==null?null:broke&&retested?94:broke?68:50;

  const triggerDist=Number.isFinite(resistanceDist)?Math.abs(resistanceDist):null;
  const triggerProximityScore=triggerDist==null?null:triggerDist<=.3?94:triggerDist<=.7?84:triggerDist<=1.5?68:triggerDist<=3?50:32;
  const distanceFromVwap=sessionVwap?Math.abs(last.c-sessionVwap)/last.c*100:null;
  const chaseAtr=atrPct&&distanceFromVwap!=null?distanceFromVwap/atrPct:null;
  const chaseAvoidanceScore=chaseAtr==null?null:chaseAtr<=.5?94:chaseAtr<=.9?82:chaseAtr<=1.4?62:35;
  const entryParts=[triggerProximityScore,confirmationScore,chaseAvoidanceScore].filter((x):x is number=>x!=null);
  const entryPrecisionScore=entryParts.length?entryParts.reduce((a,b)=>a+b,0)/entryParts.length:null;

  return{anchoredVwapScore,sessionVwap,stopDistanceScore,rewardRiskScore,rewardRiskRatio:rr,lossContainmentScore,absorptionScore,openingAuctionScore,pullbackScore,baseScore,reversalScore,confluenceScore,failedMoveRiskScore,cleanInvalidationScore,timeOfDayScore,confirmationScore,reclaimHoldScore,retestScore,triggerProximityScore,chaseAvoidanceScore,entryPrecisionScore};
}
export async function featureSet(symbol:string):Promise<FeatureSet|null>{
  if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return null;
  const now=Date.now(),d180=new Date(now-220*86400000).toISOString(),d15=new Date(now-15*86400000).toISOString(),d3=new Date(now-3*86400000).toISOString();
  const [daily,hourly,intra]=await Promise.all([historicalBars(symbol,"1Day",d180,300),historicalBars(symbol,"1Hour",d15,500),historicalBars(symbol,"5Min",d3,1000)]);
  const dc=daily.map(x=>x.c),dv=daily.map(x=>x.v),a=atr(daily,14),last=daily[daily.length-1]?.c;
  const e20=ema(dc,20),e50=ema(dc,50),v20=sma(dv,20);
  const dailyVolRatio=v20&&dv.length?dv[dv.length-1]/v20:null;
  const total=daily.length+hourly.length+intra.length;
  return{
    symbol,feed:process.env.ALPACA_FEED||"iex",generatedAt:new Date().toISOString(),
    daily:{
      trendScore:trendScore(daily,20,50),ema20:e20,ema50:e50,atr14Pct:a&&last?a/last*100:null,roc20Pct:roc(daily,20),volumeRatio20:dailyVolRatio,
      avgVolume20:v20,
      realizedVol20Pct:(()=>{const rets=dc.slice(-21).map((x,i,a)=>i?Math.log(x/a[i-1]):0).slice(1);const sd=stdev(rets);return sd==null?null:sd*Math.sqrt(252)*100})(),
      chartCleanliness:(()=>{const t=trendScore(daily,20,50);if(t==null)return null;const closes=dc.slice(-20),e=ema(dc,20);if(e==null||!closes.length)return null;const same=closes.filter(x=>t>=50?x>=e:x<=e).length/closes.length;return clamp(45+same*50)})(),
      tradeability:(()=>{const atrPct=a&&last?a/last*100:null;if(atrPct==null||v20==null)return null;const volScore=v20>=1e7?95:v20>=3e6?85:v20>=1e6?72:v20>=3e5?55:35;const atrScore=atrPct<=1?58:atrPct<=4?90:atrPct<=7?72:45;return clamp(.6*volScore+.4*atrScore)})()
    },
    hourly:{trendScore:trendScore(hourly,9,20),rocPct:roc(hourly,12)},
    intraday:intradayFeatures(intra),
    structure:structureFeatures(intra,daily,intradayFeatures(intra)),
    quality:{barCount:total,coverageScore:clamp(total/12),note:"Historical bars are derived from the configured Alpaca feed; IEX is partial-market coverage."}
  };
}
