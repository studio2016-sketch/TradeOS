export interface ResearchForecast{time:string;probability:number;outcome:0|1}
export interface ChronologicalValidation{
 status:"INSUFFICIENT_EVIDENCE"|"RESEARCH_ONLY";
 sampleCount:number;trainCount:number;holdoutCount:number;
 modelBrier:number|null;baselineBrier:number|null;
 skillVsFrozenTrainBaseline:number|null;
 bootstrap95PctSkillInterval:[number,number]|null;
 evidenceOfImprovement:boolean;
 warnings:string[];
}
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const brier=(xs:ResearchForecast[],prediction:(x:ResearchForecast)=>number)=>mean(xs.map(x=>(prediction(x)-x.outcome)**2));
/** Deterministic bootstrap protects test repeatability; resamples only frozen holdout errors. */
function resampleSkill(rows:ResearchForecast[],baseline:number,rounds=1000):[number,number]{
 let state=16777619;
 function rand(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
 const gains:number[]=[];
 for(let i=0;i<rounds;i++){
  const group=Array.from({length:rows.length},()=>rows[Math.floor(rand()*rows.length)]);
  const model=brier(group,x=>x.probability),ref=brier(group,()=>baseline);
  gains.push(ref-model);
 }
 gains.sort((a,b)=>a-b);
 return [gains[Math.floor(.025*(rounds-1))],gains[Math.floor(.975*(rounds-1))]];
}
/**
 * Exploratory validation of historical forecast *records*, not promotion-ready OOS.
 * Requires genuinely timestamped predictions made before labels were observed.
 */
export function validateChronologicalForecasts(raw:ResearchForecast[]):ChronologicalValidation{
 const rows=raw.filter(x=>Number.isFinite(Date.parse(x.time))&&Number.isFinite(x.probability)&&x.probability>=0&&x.probability<=1&&(x.outcome===0||x.outcome===1)).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 const trainCount=Math.floor(rows.length*.7),holdout=rows.slice(trainCount),train=rows.slice(0,trainCount);
 const warnings=["Research-only: forecast records are not independently certified against original decision-time inputs.","This split does not prove model weights were frozen before the holdout; no automatic promotion.","Comparison uses train-period unconditional base rate and ignores execution costs, slippage and overlapping forecasts."];
 if(train.length<50||holdout.length<30)return{status:"INSUFFICIENT_EVIDENCE",sampleCount:rows.length,trainCount:train.length,holdoutCount:holdout.length,modelBrier:null,baselineBrier:null,skillVsFrozenTrainBaseline:null,bootstrap95PctSkillInterval:null,evidenceOfImprovement:false,warnings};
 const baseline=mean(train.map(x=>x.outcome));
 const bm=brier(holdout,x=>x.probability),bb=brier(holdout,()=>baseline);
 const interval=resampleSkill(holdout,baseline);
 return{status:"RESEARCH_ONLY",sampleCount:rows.length,trainCount:train.length,holdoutCount:holdout.length,modelBrier:bm,baselineBrier:bb,skillVsFrozenTrainBaseline:bb>0?1-bm/bb:null,bootstrap95PctSkillInterval:interval,evidenceOfImprovement:interval[0]>0,warnings};
}
