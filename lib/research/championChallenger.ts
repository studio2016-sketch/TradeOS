import {db} from "../db";
import {TRIAL_ACTIVATION,BASELINE_VERSION,CHALLENGER_VERSION} from "./frozenChallenger";

function stats(rows:any[]){
  const n=rows.length;
  if(!n)return{samples:0,hitRate:null,brier:null,avgReturn:null,avgAdverse:null};
  const hit=rows.filter(r=>r.was_correct===true).length/n;
  const brier=rows.reduce((s,r)=>s+Math.pow(Number(r.probability)-(r.was_correct?1:0),2),0)/n;
  const avgReturn=rows.reduce((s,r)=>s+Number(r.realized_return??0),0)/n;
  const avgAdverse=rows.reduce((s,r)=>s+Number(r.max_adverse_excursion??0),0)/n;
  return{samples:n,hitRate:+hit.toFixed(4),brier:+brier.toFixed(6),avgReturn:+avgReturn.toFixed(6),avgAdverse:+avgAdverse.toFixed(6)};
}

export async function championChallengerEvaluation(){
  const sql=db();
  const rows=await sql`
    select f.id,f.created_at,f.symbol,f.model_version,f.horizon,f.direction,f.probability,
           o.was_correct,o.realized_return,o.max_adverse_excursion
    from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
    where f.created_at >= ${TRIAL_ACTIVATION}::timestamptz
      and f.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})
      and o.was_correct is not null
    order by f.created_at asc
  ` as any[];
  const baseline=stats(rows.filter(r=>r.model_version===BASELINE_VERSION));
  const challenger=stats(rows.filter(r=>r.model_version===CHALLENGER_VERSION));
  const matchedKeys=new Set(rows.filter(r=>r.model_version===BASELINE_VERSION).map(r=>String(r.symbol)+"|"+String(r.horizon)+"|"+new Date(r.created_at).toISOString().slice(0,16)));
  const matchedChallenger=rows.filter(r=>r.model_version===CHALLENGER_VERSION&&matchedKeys.has(String(r.symbol)+"|"+String(r.horizon)+"|"+new Date(r.created_at).toISOString().slice(0,16)));
  const matched=matchedChallenger.length;
  const minimum=60;
  let result:"INSUFFICIENT_PROSPECTIVE_DATA"|"BASELINE_LEADS"|"CHALLENGER_LEADS"|"NO_CLEAR_WINNER"="INSUFFICIENT_PROSPECTIVE_DATA";
  if(baseline.samples>=minimum&&challenger.samples>=minimum&&matched>=minimum){
    const brierDelta=(challenger.brier??1)-(baseline.brier??1);
    const hitDelta=(challenger.hitRate??0)-(baseline.hitRate??0);
    if(brierDelta<=-.015&&hitDelta>=-.02)result="CHALLENGER_LEADS";
    else if(brierDelta>=.015&&hitDelta<=.02)result="BASELINE_LEADS";
    else result="NO_CLEAR_WINNER";
  }
  let immutableCoverage:any={baseline:0,challenger:0};
  try{
    const imm=await sql`
      select model_version,count(*)::int as n from immutable_decision_records
      where recorded_at >= ${TRIAL_ACTIVATION}::timestamptz
        and model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})
      group by model_version
    ` as any[];
    immutableCoverage={
      baseline:Number(imm.find(x=>x.model_version===BASELINE_VERSION)?.n??0),
      challenger:Number(imm.find(x=>x.model_version===CHALLENGER_VERSION)?.n??0)
    };
  }catch(_){}
  return{
    trialActivation:TRIAL_ACTIVATION,baselineVersion:BASELINE_VERSION,challengerVersion:CHALLENGER_VERSION,
    baseline,challenger,matchedSamples:matched,minimumMatchedSamples:minimum,result,
    promotionAllowed:false,
    immutableCoverage,
    policy:"Prospective comparison only. This evaluator can identify a leader but cannot promote a model; Research Certification Authority approval is separately required."
  };
}
