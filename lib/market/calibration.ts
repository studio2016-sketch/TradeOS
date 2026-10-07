export interface ForecastSample{p:number;outcome:0|1}
export function brierScore(samples:ForecastSample[]){
 if(!samples.length)return null;
 return samples.reduce((s,x)=>s+Math.pow(x.p-x.outcome,2),0)/samples.length;
}
export function calibrationError(samples:ForecastSample[],bins=10){
 if(!samples.length)return null;
 const groups=Array.from({length:bins},()=>[] as ForecastSample[]);
 for(const s of samples){groups[Math.min(bins-1,Math.floor(s.p*bins))].push(s)}
 let total=0;
 for(const g of groups){
   if(!g.length)continue;
   const meanP=g.reduce((s,x)=>s+x.p,0)/g.length;
   const freq=g.reduce((s,x)=>s+x.outcome,0)/g.length;
   total+=g.length/samples.length*Math.abs(meanP-freq);
 }
 return total;
}
export function confidencePenalty(brier:number|null,ece:number|null){
 if(brier===null||ece===null)return .65;
 const quality=1-(Math.min(.5,brier)*1.2+Math.min(.5,ece)*.8);
 return Math.max(.35,Math.min(1,quality));
}
