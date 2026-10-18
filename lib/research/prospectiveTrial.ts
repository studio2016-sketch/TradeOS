export type PairedForecast={timestamp:string;symbol:string;baselineP:number;challengerP:number;outcome:0|1};
/** Paired, session-day clustered errors. No automatic model promotion. */
export function evaluateProspectivePairs(input:PairedForecast[]){
 const good=input.filter(x=>Number.isFinite(Date.parse(x.timestamp))&&[x.baselineP,x.challengerP].every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&(x.outcome===0||x.outcome===1));
 const groups=new Map<string,PairedForecast[]>();
 for(const row of good){const date=row.timestamp.slice(0,10);groups.set(date,[...(groups.get(date)||[]),row])}
 const brier=(xs:PairedForecast[],key:"baselineP"|"challengerP")=>xs.reduce((s,x)=>s+(x[key]-x.outcome)**2,0)/xs.length;
 const meanErrorDifference=good.length?brier(good,"baselineP")-brier(good,"challengerP"):null;
 const sufficient=good.length>=200&&groups.size>=20;
 let interval:[number,number]|null=null;
 if(sufficient){
  const days=[...groups.values()],samples:number[]=[];let seed=0x8172;
  function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<1500;i++){
   const picked=Array.from({length:days.length},()=>days[Math.floor(rnd()*days.length)]).flat();
   samples.push(brier(picked,"baselineP")-brier(picked,"challengerP"));
  }
  samples.sort((a,b)=>a-b);
  interval=[samples[Math.floor(samples.length*.025)],samples[Math.floor(samples.length*.975)]];
 }
 return{status:sufficient?"RESEARCH_ONLY":"INSUFFICIENT_PROSPECTIVE_DATA",pairedCount:good.length,independentSessionDates:groups.size,
 baselineBrier:good.length?brier(good,"baselineP"):null,
 challengerBrier:good.length?brier(good,"challengerP"):null,
 pairedBrierImprovement:meanErrorDifference,clustered95PctInterval:interval,
 preliminaryEvidenceOfImprovement:Boolean(interval&&interval[0]>0),
 independentlyCertified:false,eligibleForLive:false,
 warnings:["Pre-registration and paired chronological observations do not independently certify market source timing, overlapping labels or execution-cost performance.","Model revisions were frozen before future data collection; promotion requires additional untouched and independent testing.","Brokerage or live order authorization is not connected to this analysis."]};
}
