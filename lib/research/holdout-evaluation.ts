export type Observation={time:string;signal:number;nextReturn:number};
export type Evaluation={samples:number;meanNetReturn:number;baselineMean:number;improvement:number;standardError:number;confidenceLow:number;confidenceHigh:number;costBps:number;eligibleForPromotion:false;reason:string};
export function evaluateLockedHoldout(rows:Observation[],costBps:number,baselineMean=0):Evaluation{
 if(!Array.isArray(rows)||rows.length<2||rows.length>100000)throw Error("Require 2-100000 observations");
 if(!Number.isFinite(costBps)||costBps<0||costBps>1000)throw Error("Invalid costs");
 if(!Number.isFinite(baselineMean))throw Error("Invalid baseline");
 let last=-Infinity;
 const net=rows.map(r=>{
  const timestamp=Date.parse(r.time);
  if(!Number.isFinite(timestamp)||timestamp<=last)throw Error("Observations must be chronological and unique");
  last=timestamp;
  if(!Number.isFinite(r.signal)||Math.abs(r.signal)>1||!Number.isFinite(r.nextReturn)||Math.abs(r.nextReturn)>1)throw Error("Invalid signal or return");
  return r.signal*r.nextReturn-Math.abs(r.signal)*costBps/10000;
 });
 const n=net.length,mean=net.reduce((a,b)=>a+b,0)/n;
 const variance=net.reduce((sum,x)=>sum+(x-mean)**2,0)/(n-1);
 const se=Math.sqrt(variance/n),delta=mean-baselineMean;
 return {samples:n,meanNetReturn:mean,baselineMean,improvement:delta,standardError:se,confidenceLow:delta-1.96*se,confidenceHigh:delta+1.96*se,costBps,eligibleForPromotion:false,reason:"Exploratory chronological evaluation only. Autocorrelation, selection bias, independent data provenance, and untouched holdout status are not established."};
}
