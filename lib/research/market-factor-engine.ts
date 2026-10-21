/** Pure calculations; never infer missing historical prices. All bars must be chronological. */
export type PriceBar={timestamp:string;open:number;high:number;low:number;close:number;volume:number};
export type DerivedFactor={value:number|null;reason?:string;asOf?:string;inputCount:number};
const absent=(reason:string,inputCount=0):DerivedFactor=>({value:null,reason,inputCount});
const valid=(value:number,count:number,asOf:string):DerivedFactor=>Number.isFinite(value)?{value,inputCount:count,asOf}:absent("non_finite_result",count);
export function calculateMarketFactors(raw:PriceBar[]):Record<string,DerivedFactor>{
 const bars=[...raw].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)).filter(b=>Number.isFinite(Date.parse(b.timestamp))&&[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.close>0&&b.high>=b.low&&b.volume>=0);
 const n=bars.length,last=bars[n-1],result:Record<string,DerivedFactor>={};
 const compute=(key:string,period:number,fn:(slice:PriceBar[])=>number)=>{
  if(n<period){result[key]=absent("insufficient_bars",n);return;}
  const slice=bars.slice(-period);result[key]=valid(fn(slice),period,last.timestamp);
 };
 for(const [key,period] of [["sma_5",5],["sma_20",20],["sma_50",50],["sma_200",200]] as const)
  compute(key,period,s=>s.reduce((sum,b)=>sum+b.close,0)/period);
 for(const [key,period] of [["return_1d",2],["return_5d",6]] as const)
  compute(key,period,s=>s[s.length-1].close/s[0].close-1);
 compute("intraday_range",1,s=>(s[0].high-s[0].low)/s[0].close);
 compute("dollar_volume",1,s=>s[0].close*s[0].volume);
 compute("gap_pct",2,s=>s[1].open/s[0].close-1);
 // Difference between successive completed daily close-to-close returns.
 compute("price_acceleration",3,s=>(s[2].close/s[1].close-1)-(s[1].close/s[0].close-1));
 compute("relative_volume",21,s=>s[20].volume/(s.slice(0,20).reduce((v,b)=>v+b.volume,0)/20));
 compute("atr_14",15,s=>s.slice(1).reduce((v,b,i)=>v+Math.max(b.high-b.low,Math.abs(b.high-s[i].close),Math.abs(b.low-s[i].close)),0)/14);
 for(const period of [5,20] as const)compute(`realized_vol_${period}`,period+1,s=>{
  const returns=s.slice(1).map((b,i)=>Math.log(b.close/s[i].close));
  const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
  return Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1))*Math.sqrt(252);
 });
 // Relative short/long realized volatility is a continuous regime proxy,
 // not a certified categorical market regime or an independent data source.
 const vol5=result.realized_vol_5?.value,vol20=result.realized_vol_20?.value;
 result.volatility_regime=vol5!==null&&vol5!==undefined&&vol20!==null&&vol20!==undefined&&vol20>0
  ?valid(vol5/vol20,21,last.timestamp):absent(n<21?"insufficient_bars":"zero_long_window_volatility",n);
 // Volatility-of-volatility: sample dispersion of 20 overlapping five-session
 // annualized realized-volatility estimates. Requires 25 completed daily bars.
 compute("vol_of_vol",25,s=>{
  const closes=s.map(b=>b.close);
  const rolling:number[]=[];
  for(let end=5;end<closes.length;end++){
   const logReturns:number[]=[];
   for(let i=end-4;i<=end;i++)logReturns.push(Math.log(closes[i]/closes[i-1]));
   const mean=logReturns.reduce((sum,x)=>sum+x,0)/5;
   const realized=Math.sqrt(logReturns.reduce((sum,x)=>sum+(x-mean)**2,0)/4)*Math.sqrt(252);
   rolling.push(realized);
  }
  const mean=rolling.reduce((sum,x)=>sum+x,0)/rolling.length;
  return Math.sqrt(rolling.reduce((sum,x)=>sum+(x-mean)**2,0)/(rolling.length-1));
 });
 for(const [key,period] of [["ema_9",9],["ema_21",21]] as const)compute(key,period,s=>{
  const alpha=2/(period+1);return s.slice(1).reduce((ema,b)=>alpha*b.close+(1-alpha)*ema,s[0].close);
 });
 // MACD uses the full completed history, rather than seeding on a short trailing window.
 if(n>=35){
  const closes=bars.map(b=>b.close);
  const ema=(period:number)=>{const alpha=2/(period+1);let v=closes[0];return closes.map((c,i)=>v=i===0?c:alpha*c+(1-alpha)*v);};
  const fast=ema(12),slow=ema(26),macd=fast.map((v,i)=>v-slow[i]);
  const alpha=2/10;let signal=macd[0];for(let i=1;i<macd.length;i++)signal=alpha*macd[i]+(1-alpha)*signal;
  result.macd=valid(macd[n-1],n,last.timestamp);
  result.macd_signal=valid(signal,n,last.timestamp);
 }else{result.macd=absent("insufficient_bars",n);result.macd_signal=absent("insufficient_bars",n);}
 // ADX: Wilder smoothing, at least two complete 14-bar smoothing periods.
 if(n>=29){
  const period=14,trs:number[]=[],plus:number[]=[],minus:number[]=[];
  for(let i=1;i<n;i++){const b=bars[i],prev=bars[i-1],up=b.high-prev.high,down=prev.low-b.low;
   trs.push(Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close)));
   plus.push(up>down&&up>0?up:0);minus.push(down>up&&down>0?down:0);
  }
  const smooth=(arr:number[])=>{let v=arr.slice(0,period).reduce((a,b)=>a+b,0);const out=[v];for(let i=period;i<arr.length;i++){v=v-v/period+arr[i];out.push(v);}return out;};
  const tr=smooth(trs),p=smooth(plus),m=smooth(minus);
  const dx=tr.map((v,i)=>v>0?100*Math.abs(p[i]-m[i])/(p[i]+m[i]||1):0);
  let adx=dx.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<dx.length;i++)adx=((period-1)*adx+dx[i])/period;
  result.adx=valid(adx,n,last.timestamp);
 }else result.adx=absent("insufficient_bars",n);
 // Breakout relative to the previous 20 completed sessions, never the current bar.
 if(n>=21){const prior=bars.slice(-21,-1),high=Math.max(...prior.map(b=>b.high)),low=Math.min(...prior.map(b=>b.low));
  result.breakout_strength=valid(high>low?(last.close-high)/(high-low):0,21,last.timestamp);
 }else result.breakout_strength=absent("insufficient_bars",n);
 // Historical overnight gap dispersion: sample standard deviation of open/previous close.
 compute("overnight_vol",21,s=>{const gaps=s.slice(1).map((b,i)=>Math.log(b.open/s[i].close));const avg=gaps.reduce((a,b)=>a+b,0)/gaps.length;return Math.sqrt(gaps.reduce((a,b)=>a+(b-avg)**2,0)/(gaps.length-1));});
 // Frequency of overnight absolute gaps greater than 2% in the preceding 20 transitions.
 compute("gap_frequency",21,s=>s.slice(1).filter((b,i)=>Math.abs(b.open/s[i].close-1)>0.02).length/20);
 // Portfolio drawdown, VaR and expected shortfall require position weights
 // and synchronized multi-asset returns. Single-security proxies are not emitted.
 result.max_drawdown=absent("portfolio_holdings_required",n);
 result.var_95=absent("portfolio_holdings_required",n);
 result.expected_shortfall=absent("portfolio_holdings_required",n);
 return result;
}

/** Benchmark-relative calculations require synchronized completed sessions. */
export function calculateRelativeMarketFactors(raw:PriceBar[],benchmarkRaw:PriceBar[]):Record<string,DerivedFactor>{
 const clean=(bars:PriceBar[])=>[...bars].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp)).filter(b=>Number.isFinite(Date.parse(b.timestamp))&&Number.isFinite(b.close)&&b.close>0);
 const symbol=clean(raw),benchmark=clean(benchmarkRaw),byDate=new Map(benchmark.map(b=>[b.timestamp.slice(0,10),b.close]));
 const paired=symbol.map(b=>({date:b.timestamp.slice(0,10),symbol:b.close,benchmark:byDate.get(b.timestamp.slice(0,10))})).filter((x):x is {date:string;symbol:number;benchmark:number}=>typeof x.benchmark==="number");
 if(paired.length<21)return {beta:absent("insufficient_synchronized_bars",paired.length),rolling_correlation:absent("insufficient_synchronized_bars",paired.length)};
 const window=paired.slice(-21),sr:number[]=[],br:number[]=[];
 for(let i=1;i<window.length;i++){sr.push(window[i].symbol/window[i-1].symbol-1);br.push(window[i].benchmark/window[i-1].benchmark-1);}
 const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length,sm=mean(sr),bm=mean(br);
 let covariance=0,symbolVariance=0,benchmarkVariance=0;
 for(let i=0;i<sr.length;i++){const s=sr[i]-sm,b=br[i]-bm;covariance+=s*b;symbolVariance+=s*s;benchmarkVariance+=b*b;}
 const count=sr.length,asOf=window[window.length-1].date+"T00:00:00Z";
 return {
  beta:benchmarkVariance>0?valid(covariance/benchmarkVariance,count,asOf):absent("zero_benchmark_variance",count),
  rolling_correlation:symbolVariance>0&&benchmarkVariance>0?valid(covariance/Math.sqrt(symbolVariance*benchmarkVariance),count,asOf):absent("zero_return_variance",count)
 };
}
