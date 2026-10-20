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
 compute("relative_volume",21,s=>s[20].volume/(s.slice(0,20).reduce((v,b)=>v+b.volume,0)/20));
 compute("atr_14",15,s=>s.slice(1).reduce((v,b,i)=>v+Math.max(b.high-b.low,Math.abs(b.high-s[i].close),Math.abs(b.low-s[i].close)),0)/14);
 for(const period of [5,20] as const)compute(`realized_vol_${period}`,period+1,s=>{
  const returns=s.slice(1).map((b,i)=>Math.log(b.close/s[i].close));
  const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
  return Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1))*Math.sqrt(252);
 });
 for(const [key,period] of [["ema_9",9],["ema_21",21]] as const)compute(key,period,s=>{
  const alpha=2/(period+1);return s.slice(1).reduce((ema,b)=>alpha*b.close+(1-alpha)*ema,s[0].close);
 });
 return result;
}
