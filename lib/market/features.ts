export interface Bar{t:string;o:number;h:number;l:number;c:number;v:number;vw?:number;n?:number}
export interface FeatureSet{
  symbol:string;feed:string;generatedAt:string;
  daily:{trendScore:number|null;ema20:number|null;ema50:number|null;atr14Pct:number|null;roc20Pct:number|null;volumeRatio20:number|null};
  hourly:{trendScore:number|null;rocPct:number|null};
  intraday:{trendScore:number|null;rocPct:number|null;rsi14:number|null;vwapHoldScore:number|null;openingRangeScore:number|null;breakoutScore:number|null;volumeAcceleration:number|null;supportDistancePct:number|null;resistanceDistancePct:number|null};
  quality:{barCount:number;coverageScore:number;note:string};
}
function ema(xs:number[],p:number){if(xs.length<p)return null;const k=2/(p+1);let e=xs.slice(0,p).reduce((a,b)=>a+b,0)/p;for(const x of xs.slice(p))e=x*k+e*(1-k);return e}
function sma(xs:number[],p:number){return xs.length<p?null:xs.slice(-p).reduce((a,b)=>a+b,0)/p}
function rsi(xs:number[],p=14){if(xs.length<=p)return null;let g=0,l=0;for(let i=xs.length-p;i<xs.length;i++){const d=xs[i]-xs[i-1];if(d>=0)g+=d;else l-=d}if(l===0)return 100;const rs=(g/p)/(l/p);return 100-100/(1+rs)}
function atr(b:Bar[],p=14){if(b.length<=p)return null;const tr=b.slice(1).map((x,i)=>Math.max(x.h-x.l,Math.abs(x.h-b[i].c),Math.abs(x.l-b[i].c)));return sma(tr,p)}
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
  return{trendScore:trendScore(b),rocPct:roc(b,12),rsi14:rsi(c),vwapHoldScore:vwapHold,openingRangeScore,breakoutScore:breakout,volumeAcceleration,supportDistancePct:support?((last.c-support)/last.c)*100:null,resistanceDistancePct:resistance?((resistance-last.c)/last.c)*100:null};
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
    daily:{trendScore:trendScore(daily,20,50),ema20:e20,ema50:e50,atr14Pct:a&&last?a/last*100:null,roc20Pct:roc(daily,20),volumeRatio20:dailyVolRatio},
    hourly:{trendScore:trendScore(hourly,9,20),rocPct:roc(hourly,12)},
    intraday:intradayFeatures(intra),
    quality:{barCount:total,coverageScore:clamp(total/12),note:"Historical bars are derived from the configured Alpaca feed; IEX is partial-market coverage."}
  };
}
