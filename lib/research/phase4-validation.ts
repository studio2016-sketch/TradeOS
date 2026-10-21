export type PairedForecastLoss={time:string;baselineLoss:number;challengerLoss:number};

function mean(xs:number[]){return xs.reduce((a,b)=>a+b,0)/xs.length;}

export function pairedProspectiveValidation(raw:PairedForecastLoss[]){
 const rows=raw.filter(r=>Number.isFinite(Date.parse(r.time))&&Number.isFinite(r.baselineLoss)&&Number.isFinite(r.challengerLoss))
  .sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(!rows.length)return {pairs:0,sessions:0,meanImprovement:null,bootstrap95:[null,null] as [number|null,number|null],lowerBound:null,mature:false};
 const improvements=rows.map(r=>r.baselineLoss-r.challengerLoss);
 const sessions=new Set(rows.map(r=>new Date(r.time).toISOString().slice(0,10))).size;
 let state=2166136261>>>0;
 const gains:number[]=[];
 const rounds=2000;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let k=0;k<rounds;k++){
  let sum=0;
  for(let i=0;i<improvements.length;i++)sum+=improvements[Math.floor(rand()*improvements.length)];
  gains.push(sum/improvements.length);
 }
 gains.sort((a,b)=>a-b);
 const low=gains[Math.floor(.025*(rounds-1))],high=gains[Math.floor(.975*(rounds-1))];
 return {pairs:rows.length,sessions,meanImprovement:mean(improvements),bootstrap95:[low,high] as [number,number],lowerBound:low,mature:rows.length>=200&&sessions>=20&&low>0};
}

export type Phase4InfrastructureInput={
 immutableRecords:number;immutableLinked:number;structuralPointInTime:number;
 resolvedOutcomes:number;outcomeChronologyOk:number;baselineFingerprints:number;challengerFingerprints:number;
 pairedSamples:number;sessionDates:number;invalidEvidenceVintages:number;
};
export function phase4InfrastructureGate(i:Phase4InfrastructureInput){
 const checks=[
  {id:"immutable_volume",pass:i.immutableRecords>=200,detail:"At least 200 append-only immutable decisions"},
  {id:"forecast_linkage",pass:i.immutableRecords>0&&i.immutableLinked===i.immutableRecords,detail:"Every immutable decision links to its original forecast"},
  {id:"structural_point_in_time",pass:i.immutableRecords>0&&i.structuralPointInTime===i.immutableRecords,detail:"Every immutable decision observation time is not after its decision record"},
  {id:"outcome_chronology",pass:i.resolvedOutcomes>0&&i.outcomeChronologyOk===i.resolvedOutcomes,detail:"Every resolved outcome timestamp is after the forecast"},
  {id:"frozen_model_fingerprints",pass:i.baselineFingerprints===1&&i.challengerFingerprints===1,detail:"Exactly one frozen fingerprint per prospective model"},
  {id:"paired_trial_running",pass:i.pairedSamples>=100&&i.sessionDates>=3,detail:"At least 100 matched prospective pairs across at least 3 sessions"},
  {id:"evidence_vintage_integrity",pass:i.invalidEvidenceVintages===0,detail:"No factor evidence is available before it is observed"}
 ];
 const blockers=checks.filter(x=>!x.pass).map(x=>x.id);
 return {phase:"4",scope:"validation_infrastructure",passed:blockers.length===0,checks,blockers,
  scientificCertificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false};
}
