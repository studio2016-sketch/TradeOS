import {OUTCOME_PROTOCOL_CONFORMANCE} from "./outcome-protocol-conformance";
import {db} from "../db";
import {TRIAL_ACTIVATION,BASELINE_VERSION,CHALLENGER_VERSION} from "./frozenChallenger";
import {readComparablePairs,validateComparablePairs} from "./comparable-pair-reader";

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
  // Use the same unique-target, protocol-bound comparison as scientific validation.
  // The sentinel cap rejects partial candidate sets rather than inferring uniqueness.
  const pairing=await readComparablePairs(sql,TRIAL_ACTIVATION);
  const pairedValidation=validateComparablePairs(pairing);
  const matched=pairedValidation.pairs;
  const minimum=200,minimumSessions=20;
  const depthSatisfied=matched>=minimum&&pairedValidation.sessions>=minimumSessions;
  const [low,high]=pairedValidation.bootstrap95;
  let result:"INSUFFICIENT_PROSPECTIVE_DATA"|"BASELINE_LEADS"|"CHALLENGER_LEADS"|"NO_CLEAR_WINNER"="INSUFFICIENT_PROSPECTIVE_DATA";
  // phase4's mature flag is specifically positive challenger improvement. Do not
  // use it to suppress statistically supported baseline leadership.
  if(depthSatisfied&&low!==null&&high!==null){
    result=low>0?"CHALLENGER_LEADS":high<0?"BASELINE_LEADS":"NO_CLEAR_WINNER";
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
    baseline,challenger,matchedSamples:matched,minimumMatchedSamples:minimum,minimumIndependentSessions:minimumSessions,pairedValidation,result,
    comparisonReadiness:{depthSatisfied,intervalAvailable:low!==null&&high!==null,intervalExcludesZero:low!==null&&high!==null&&(low>0||high<0)},
    pairing:pairing.diagnostics,outcomeDisagreements:pairing.outcomeDisagreements,
    historicalReconstruction:{pairs:pairing.reconstructedPairs.length,eligibleForProspectiveDepth:false},
    comparisonScope:"Only unique forecasts with reproducible matching targets, observations and frozen outcome protocol enter prospective comparison. Individual model summaries remain descriptive and may include excluded outcomes.",
    promotionAllowed:false,
    protocolConformance:OUTCOME_PROTOCOL_CONFORMANCE,
    warnings:["Leader and paired metrics are descriptive research only. "+OUTCOME_PROTOCOL_CONFORMANCE.reason],
    immutableCoverage,
    policy:"Prospective paired comparison only. A leader requires at least 200 matched predictions across 20 independent sessions and a nonzero paired confidence result. This evaluator cannot promote a model; Research Certification Authority approval is separately required."
  };
}
