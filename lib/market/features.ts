export interface Bar{t:string;o:number;h:number;l:number;c:number;v:number;vw?:number;n?:number}
export interface FeatureSet{
  symbol:string;feed:string;generatedAt:string;
  daily:{trendScore:number|null;ema20:number|null;ema50:number|null;atr14Pct:number|null;roc20Pct:number|null;volumeRatio20:number|null;avgVolume20:number|null;realizedVol20Pct:number|null;chartCleanliness:number|null;tradeability:number|null};
  hourly:{trendScore:number|null;rocPct:number|null};
  intraday:{trendScore:number|null;rocPct:number|null;rsi14:number|null;macdScore:number|null;priceAcceleration:number|null;momentumPersistence:number|null;squeezeScore:number|null;vwapHoldScore:number|null;openingRangeScore:number|null;breakoutScore:number|null;breakoutVolumeScore:number|null;volumeAcceleration:number|null;accumulationScore:number|null;rangeConditionScore:number|null;supportDistancePct:number|null;resistanceDistancePct:number|null};
  quality:{barCount:number;coverageScore:number;note:string};
}
function ema(xs:number[],p:number){if(xs.length<p)return null;const k=2/(p+1);let e=xs.slice(0,p).reduce((a,b)=>a+b,0)/p;for(const x of xs.slice(p))e=x*k+e*(1-k);return e}
function sma(xs:number[],p:number){return xs.length<p?null:xs.slice(-p).reduce((a,b)=>a+b,0)/p}
function rsi(xs:number[],p=14){if(xs.length<=p)return null;let g=0,l=0;for(let i=xs.length-p;i<xs.length;i++){const d=xs[i]-xs[i-1];if(d>=0)g+=d;else l-=d}if(l===0)return 100;const rs=(g/p)/(l/p);return 100-100/(1+rs)}
function atr(b:Bar[],p=14){if(b.length<=p)return null;const tr=b.slice(1).map((x,i)=>Math.max(x.h-x.l,Math.abs(x.h-b[i].c),Math.abs(x.l-b[i].c)));return sma(tr,p)}
function stdev(xs:number[]){if(xs.length<2)return null;const m=xs.reduce((a,b)=>a+b,0)/xs.length;return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))}
function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,n))}
async function bars(symbol:string,timeframe:string,start:string,limit=1000):Promise<Bar[]>{
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
  if(b.length<10)return {trendScore:null,rocPct:null,rsi14:null,vwapHoldScore:null,openingRangeScore:null,breakoutScore:null,volumeAcceleration:null,supportDistancePct:null,resistanceDistancePct:null};
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
export async function featureSet(symbol:string):Promise<FeatureSet|null>{
  if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return null;
  const now=Date.now(),d180=new Date(now-220*86400000).toISOString(),d15=new Date(now-15*86400000).toISOString(),d3=new Date(now-3*86400000).toISOString();
  const [daily,hourly,intra]=await Promise.all([bars(symbol,"1Day",d180,300),bars(symbol,"1Hour",d15,500),bars(symbol,"5Min",d3,1000)]);
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
    quality:{barCount:total,coverageScore:clamp(total/12),note:"Historical bars are derived from the configured Alpaca feed; IEX is partial-market coverage."}
  };
}
