import {featureSet,historicalBars,type Bar} from "./features";

export interface MarketContext{
  generatedAt:string;
  broad:{SPY:number|null;QQQ:number|null;IWM:number|null;breadthScore:number|null;internalsScore:number|null};
  sector:{symbol:string;proxy:string|null;relativeStrengthScore:number|null;symbolRoc20:number|null;sectorRoc20:number|null};
  correlation:{symbol:string;spy20:number|null;score:number|null};
  session:{state:"premarket"|"regular"|"afterhours"|"closed";score:number;note:string};
}

const sectorMap:Record<string,string>={
  NVDA:"SMH",AMD:"SMH",AVGO:"SMH",INTC:"SMH",QCOM:"SMH",MU:"SMH",
  PLTR:"XLK",AAPL:"XLK",MSFT:"XLK",ORCL:"XLK",CRM:"XLK",
  META:"XLC",GOOGL:"XLC",GOOG:"XLC",NFLX:"XLC",
  AMZN:"XLY",TSLA:"XLY",HD:"XLY",
  JPM:"XLF",BAC:"XLF",GS:"XLF",
  XOM:"XLE",CVX:"XLE",
  LLY:"XLV",UNH:"XLV",
  CAT:"XLI",GE:"XLI"
};

function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,n))}
function returns(b:Bar[],n=20){
  const c=b.slice(-(n+1)).map(x=>x.c);const out:number[]=[];
  for(let i=1;i<c.length;i++)if(c[i-1]>0)out.push((c[i]-c[i-1])/c[i-1]);
  return out;
}
function corr(a:number[],b:number[]){
  const n=Math.min(a.length,b.length);if(n<8)return null;
  const x=a.slice(-n),y=b.slice(-n),mx=x.reduce((s,v)=>s+v,0)/n,my=y.reduce((s,v)=>s+v,0)/n;
  let num=0,dx=0,dy=0;for(let i=0;i<n;i++){const xa=x[i]-mx,ya=y[i]-my;num+=xa*ya;dx+=xa*xa;dy+=ya*ya}
  return dx&&dy?num/Math.sqrt(dx*dy):null;
}
function roc20(b:Bar[]){if(b.length<21)return null;const a=b[b.length-21].c,z=b[b.length-1].c;return a?((z-a)/a)*100:null}
function sessionState(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const val=(t:string)=>parts.find(p=>p.type===t)?.value||"";
  const wd=val("weekday"),h=Number(val("hour")),m=Number(val("minute")),mins=h*60+m;
  if(["Sat","Sun"].includes(wd))return{state:"closed" as const,score:30,note:"US equities weekend"};
  if(mins>=570&&mins<960)return{state:"regular" as const,score:90,note:"US regular session"};
  if(mins>=240&&mins<570)return{state:"premarket" as const,score:58,note:"US premarket; thinner liquidity"};
  if(mins>=960&&mins<1200)return{state:"afterhours" as const,score:52,note:"US after-hours; thinner liquidity"};
  return{state:"closed" as const,score:35,note:"Outside configured extended-hours window"};
}

export async function buildMarketContext(symbol:string):Promise<MarketContext|null>{
  if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return null;
  const proxy=sectorMap[symbol]??(symbol.startsWith("X")?symbol:null);
  const names=[...new Set(["SPY","QQQ","IWM",symbol,...(proxy?[proxy]:[])])];
  const fs=await Promise.all(names.map(s=>featureSet(s).catch(()=>null)));
  const by=new Map(names.map((s,i)=>[s,fs[i]]));
  const spy=by.get("SPY"),qqq=by.get("QQQ"),iwm=by.get("IWM"),sym=by.get(symbol),sector=proxy?by.get(proxy):null;
  const broadVals=[spy?.daily?.trendScore,qqq?.daily?.trendScore,iwm?.daily?.trendScore].filter((x):x is number=>x!=null);
  const breadthScore=broadVals.length?broadVals.reduce((a,b)=>a+b,0)/broadVals.length:null;
  const intradayVals=[spy?.intraday?.trendScore,qqq?.intraday?.trendScore,iwm?.intraday?.trendScore].filter((x):x is number=>x!=null);
  const internalsScore=intradayVals.length?intradayVals.reduce((a,b)=>a+b,0)/intradayVals.length:null;
  const symbolRoc20=sym?.daily?.roc20Pct??null,sectorRoc20=sector?.daily?.roc20Pct??null;
  const relativeStrengthScore=symbolRoc20==null||sectorRoc20==null?null:clamp(50+(symbolRoc20-sectorRoc20)*5);

  const start=new Date(Date.now()-60*86400000).toISOString();
  const delayedEnd=new Date(Date.now()-16*60*1000).toISOString();
  const [symBars,spyBars]=await Promise.all([
    historicalBars(symbol,"1Day",start,100,"sip",delayedEnd).catch(()=>[]),
    historicalBars("SPY","1Day",start,100,"sip",delayedEnd).catch(()=>[])
  ]);
  const c=corr(returns(symBars),returns(spyBars));
  const corrScore=c==null?null:clamp(75-Math.abs(c)*25);

  return{
    generatedAt:new Date().toISOString(),
    broad:{SPY:spy?.daily?.trendScore??null,QQQ:qqq?.daily?.trendScore??null,IWM:iwm?.daily?.trendScore??null,breadthScore,internalsScore},
    sector:{symbol,proxy,relativeStrengthScore,symbolRoc20,sectorRoc20},
    correlation:{symbol,spy20:c,score:corrScore},
    session:sessionState()
  };
}
