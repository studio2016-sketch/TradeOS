export interface FactorRecord{time:string;outcome:0|1;label:string;value:number}
export function evaluateFactorAssociation(raw:FactorRecord[]){
 const rows=raw.filter(x=>Number.isFinite(Date.parse(x.time))&&Number.isFinite(x.value)&&(x.outcome===0||x.outcome===1)).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 const group=new Map<string,FactorRecord[]>();
 for(const r of rows){const arr=group.get(r.label)||[];arr.push(r);group.set(r.label,arr)}
 return [...group].map(([label,data])=>{
  const trainCount=Math.floor(data.length*.7),training=data.slice(0,trainCount),holdout=data.slice(trainCount);
  const sorted=training.map(x=>x.value).sort((a,b)=>a-b);
  const median=sorted[Math.floor(sorted.length/2)]??null;
  const high=holdout.filter(x=>median!==null&&x.value>median),low=holdout.filter(x=>median!==null&&x.value<=median);
  const rate=(a:FactorRecord[])=>a.length?a.filter(x=>x.outcome===1).length/a.length:null;
  const a=rate(high),b=rate(low);
  const difference=a!==null&&b!==null?a-b:null;
  // Descriptive only: label overlap, multiple comparisons, outcomes clustered by day and ticker.
  return {label,recorded:data.length,training:training.length,holdout:holdout.length,trainingMedian:median,highCount:high.length,lowCount:low.length,highFrequency:a,lowFrequency:b,observedDifference:difference,meetsMinimumSamples:high.length>=30&&low.length>=30,validated:false,eligibleForModelPromotion:false,warning:"Descriptive chronological holdout association only. No point-in-time source evidence, independent instrument groups, clustered uncertainty, multiple-testing control, or execution-cost validation."};
 }).sort((a,b)=>b.recorded-a.recorded);
}
