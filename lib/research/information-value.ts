export type Outcome={timestamp:string;baselineLoss:number;macroLoss:number;newsLoss:number;baselineNet:number;macroNet:number;newsNet:number};
export function compareInformationValue(rows:Outcome[]){
 if(!Array.isArray(rows)||rows.length<30||rows.length>100000)throw Error("Need 30-100000 aligned observations");
 let last=-Infinity;
 const differences:{macro:number;news:number}[]=[];
 for(const x of rows){
  const t=Date.parse(x.timestamp);
  if(!Number.isFinite(t)||t<=last)throw Error("Chronological unique timestamps required");
  last=t;
  for(const v of [x.baselineLoss,x.macroLoss,x.newsLoss,x.baselineNet,x.macroNet,x.newsNet])if(!Number.isFinite(v))throw Error("Invalid outcome");
  differences.push({macro:x.baselineLoss-x.macroLoss,news:x.baselineLoss-x.newsLoss});
 }
 const estimate=(key:"macro"|"news")=>{
  const values=differences.map(v=>v[key]),n=values.length,mean=values.reduce((a,b)=>a+b,0)/n;
  const std=Math.sqrt(values.reduce((a,v)=>a+(v-mean)**2,0)/(n-1))/Math.sqrt(n);
  return {meanLossImprovement:mean,approximate95CI:[mean-1.96*std,mean+1.96*std],assumesIndependentRows:true};
 };
 const avg=(key:"baselineNet"|"macroNet"|"newsNet")=>rows.reduce((a,r)=>a+r[key],0)/rows.length;
 return {observations:rows.length,macro:estimate("macro"),news:estimate("news"),meanNetReturns:{baseline:avg("baselineNet"),macro:avg("macroNet"),news:avg("newsNet")},approvedForTrading:false,limitations:"Exploratory paired comparison only; out-of-sample lock, data availability, HAC uncertainty, multiplicity, baseline parity, and independent replay not established."};
}
