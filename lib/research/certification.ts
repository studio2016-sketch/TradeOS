import {db} from "../db";

export interface CertificationDecision{
  subjectId:string;
  subjectType:"factor"|"model";
  status:"RESEARCH_ONLY"|"TESTING"|"CERTIFIED"|"REJECTED";
  modelEligible:boolean;
  gates:{
    independentSources:boolean;
    prospectiveEvidence:boolean;
    sampleSufficiency:boolean;
    calibration:boolean;
    drift:boolean;
    untouchedHoldout:boolean;
  };
  evidence:{independentSourceCount:number;prospectiveSamples:number;brier:number|null;drift:number|null;holdoutSamples:number};
  reasons:string[];
  certifiedAt:string|null;
}

export async function certifyFactor(hypothesis:any):Promise<CertificationDecision>{
  const sql=db();
  const id=String(hypothesis.id);
  let validation:any[]=[];
  try{
    validation=await sql`
      select payload,created_at from audit_events
      where event_type='factor_validation_result' and entity_id=${id}
      order by created_at desc limit 200
    ` as any[];
  }catch(_){validation=[];}
  const independentSourceCount=Number(hypothesis.sourceCount??0);
  const prospective=validation.filter(v=>v.payload?.prospective===true);
  const holdout=validation.filter(v=>v.payload?.untouchedHoldout===true);
  const samples=prospective.reduce((s,v)=>s+Number(v.payload?.sampleCount??0),0);
  const briers=prospective.map(v=>Number(v.payload?.brier)).filter(Number.isFinite);
  const drifts=prospective.map(v=>Number(v.payload?.drift)).filter(Number.isFinite);
  const brier=briers.length?briers.reduce((a,b)=>a+b,0)/briers.length:null;
  const drift=drifts.length?Math.max(...drifts):null;
  const gates={
    independentSources:independentSourceCount>=Number(hypothesis.requiredIndependentSources??2),
    prospectiveEvidence:prospective.length>0,
    sampleSufficiency:samples>=Number(hypothesis.sampleFloor??80),
    calibration:brier!=null&&brier<=.20,
    drift:drift!=null&&drift<=.10,
    untouchedHoldout:holdout.reduce((s,v)=>s+Number(v.payload?.sampleCount??0),0)>=Math.max(30,Math.floor(Number(hypothesis.sampleFloor??80)*.25))
  };
  const passed=Object.values(gates).every(Boolean);
  const failed=prospective.some(v=>v.payload?.rejected===true);
  const status=failed?"REJECTED":passed?"CERTIFIED":prospective.length?"TESTING":"RESEARCH_ONLY";
  const reasons:string[]=[];
  if(!gates.independentSources)reasons.push("Fewer than two independent source families support the relationship.");
  if(!gates.prospectiveEvidence)reasons.push("No prospective validation has matured.");
  if(!gates.sampleSufficiency)reasons.push("Prospective sample floor has not been reached.");
  if(!gates.calibration)reasons.push("Calibration gate has not been proven.");
  if(!gates.drift)reasons.push("Drift stability gate has not been proven.");
  if(!gates.untouchedHoldout)reasons.push("Untouched chronological holdout evidence is insufficient.");
  return{
    subjectId:id,subjectType:"factor",status,modelEligible:status==="CERTIFIED",gates,
    evidence:{independentSourceCount,prospectiveSamples:samples,brier,drift,holdoutSamples:holdout.reduce((s,v)=>s+Number(v.payload?.sampleCount??0),0)},
    reasons,certifiedAt:status==="CERTIFIED"?new Date().toISOString():null
  };
}

export async function certifiedModelVersions(){
  const sql=db();
  const rows=await sql`
    select model_version,regime,sample_count,win_rate,brier_score,drift_score,status,updated_at
    from model_scorecards order by updated_at desc
  ` as any[];
  const out:any[]=[];
  for(const r of rows){
    let evidence:any[]=[];
    try{
      evidence=await sql`
        select payload,created_at from audit_events
        where event_type='model_independent_validation' and model_version=${r.model_version}
        order by created_at desc limit 50
      ` as any[];
    }catch(_){evidence=[];}
    const sources=new Set<string>();
    let holdoutSamples=0,prospectiveSamples=0;
    for(const e of evidence){
      for(const s of e.payload?.independentSources??[])sources.add(String(s));
      if(e.payload?.untouchedHoldout)holdoutSamples+=Number(e.payload?.sampleCount??0);
      if(e.payload?.prospective)prospectiveSamples+=Number(e.payload?.sampleCount??0);
    }
    const gates={
      independentSources:sources.size>=2,
      prospectiveEvidence:prospectiveSamples>=60,
      sampleSufficiency:Number(r.sample_count??0)>=100,
      calibration:Number(r.brier_score)<.20,
      drift:r.drift_score!=null&&Number(r.drift_score)<=.10,
      untouchedHoldout:holdoutSamples>=30
    };
    const certified=Object.values(gates).every(Boolean);
    out.push({...r,certification:certified?"CERTIFIED":"RESEARCH_ONLY",modelEligible:certified,gates,independentSources:[...sources],prospectiveSamples,holdoutSamples});
  }
  return out;
}
