export function holmBonferroni(pValues:number[],alpha=0.05){
 if(!Array.isArray(pValues)||!pValues.length||pValues.length>10000)throw Error("Invalid hypotheses");
 if(!(alpha>0&&alpha<1))throw Error("Invalid significance threshold");
 pValues.forEach(p=>{if(!Number.isFinite(p)||p<0||p>1)throw Error("Invalid p-value");});
 const ordered=pValues.map((p,index)=>({p,index})).sort((a,b)=>a.p-b.p);
 const adjusted=Array<number>(pValues.length).fill(1);
 let running=0;
 ordered.forEach((x,i)=>{running=Math.max(running,Math.min(1,x.p*(ordered.length-i)));adjusted[x.index]=running;});
 return {method:"Holm-Bonferroni",alpha,adjusted,rejected:adjusted.map(x=>x<=alpha),note:"Controls family-wise error across the submitted hypotheses only. Does not correct for unreported searches or dependent data leakage."};
}
export function neweyWestMean(values:number[],lag:number){
 if(values.length<3||values.length>100000||values.some(x=>!Number.isFinite(x)))throw Error("Invalid series");
 if(!Number.isSafeInteger(lag)||lag<0||lag>=values.length)throw Error("Invalid lag");
 const n=values.length,mean=values.reduce((a,b)=>a+b,0)/n;
 const centered=values.map(v=>v-mean);
 let longRun=centered.reduce((a,x)=>a+x*x,0)/n;
 for(let k=1;k<=lag;k++){
  let covariance=0;
  for(let t=k;t<n;t++)covariance+=centered[t]*centered[t-k];
  covariance/=n;
  longRun+=2*(1-k/(lag+1))*covariance;
 }
 const standardError=Math.sqrt(Math.max(0,longRun/n));
 return {mean,standardError,lag,ciLow:mean-1.96*standardError,ciHigh:mean+1.96*standardError,estimatedOnly:true,certificationAllowed:false};
}
