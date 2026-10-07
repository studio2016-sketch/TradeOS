export interface ModelVote{
  id:string;
  probability:number;
  quality:number;
  regimeFit:number;
  recentCalibration:number;
  independence:number;
}
export interface EnsembleResult{
  probability:number;
  dispersion:number;
  effectiveModels:number;
  decision:"consider"|"wait"|"pass";
}
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
export function combineModels(votes:ModelVote[]):EnsembleResult{
  const usable=votes.filter(v=>v.quality>0&&v.recentCalibration>0&&v.regimeFit>0);
  if(!usable.length)return{probability:.5,dispersion:1,effectiveModels:0,decision:"pass"};
  const weighted=usable.map(v=>({...v,w:v.quality*v.regimeFit*v.recentCalibration*v.independence}));
  const total=weighted.reduce((s,v)=>s+v.w,0)||1;
  const probability=weighted.reduce((s,v)=>s+v.probability*v.w,0)/total;
  const variance=weighted.reduce((s,v)=>s+v.w*Math.pow(v.probability-probability,2),0)/total;
  const dispersion=Math.sqrt(variance);
  const effectiveModels=Math.pow(total,2)/weighted.reduce((s,v)=>s+Math.pow(v.w,2),0);
  const confidence=1-dispersion;
  const decision=effectiveModels<1.5||confidence<.72?"pass":confidence<.8?"wait":"consider";
  return{probability:+clamp(probability).toFixed(4),dispersion:+dispersion.toFixed(4),effectiveModels:+effectiveModels.toFixed(2),decision};
}
