export type FactorEvidenceValue={forecastId:string;label:string;value:number};
export function factorRedundancyStudy(rows:FactorEvidenceValue[]){
 const byForecast=new Map<string,Map<string,number>>();
 for(const r of rows){
  if(!r.forecastId||!r.label||!Number.isFinite(r.value))continue;
  const values=byForecast.get(r.forecastId)||new Map<string,number>();
  values.set(r.label,r.value);byForecast.set(r.forecastId,values);
 }
 const labels=[...new Set(rows.map(r=>r.label))].sort(),output: {first:string;second:string;paired:number;pearsonR:number;status:"HIGH_CORRELATION"|"DESCRIPTIVE_ONLY"}[]=[];
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
  const x:number[]=[],y:number[]=[];
  for(const values of byForecast.values()){
   const a=values.get(labels[i]),b=values.get(labels[j]);
   if(a!==undefined&&b!==undefined){x.push(a);y.push(b)}
  }
  if(x.length<30)continue;
  const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
  let xy=0,xx=0,yy=0;
  for(let k=0;k<x.length;k++){const a=x[k]-mx,b=y[k]-my;xy+=a*b;xx+=a*a;yy+=b*b}
  if(xx<=0||yy<=0)continue;
  const pearsonR=xy/Math.sqrt(xx*yy);
  output.push({first:labels[i],second:labels[j],paired:x.length,pearsonR:+pearsonR.toFixed(4),
   status:Math.abs(pearsonR)>=.85?"HIGH_CORRELATION":"DESCRIPTIVE_ONLY"});
 }
 return {pairs:output.sort((a,b)=>Math.abs(b.pearsonR)-Math.abs(a.pearsonR)),
  warning:"Correlations describe co-movement of recorded factor values, not causal independence or predictive validity. Shared timestamps and overlapping forecasts can exaggerate apparent evidence."};
}
