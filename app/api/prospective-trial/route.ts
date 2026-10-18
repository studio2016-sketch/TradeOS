import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {TRIAL_ACTIVATION,BASELINE_VERSION,CHALLENGER_VERSION} from "../../../lib/research/frozenChallenger";
import {evaluateProspectivePairs} from "../../../lib/research/prospectiveTrial";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Research database unavailable"},{status:503});
 try{
  const sql=db();
  const rows=await sql`
    select b.observed_at as observed_at,b.symbol as symbol,
      f1.probability::float as baseline_probability,
      f2.probability::float as challenger_probability,
      o1.was_correct as baseline_outcome,o2.was_correct as challenger_outcome
    from immutable_decision_records b
    join immutable_decision_records c
      on c.symbol=b.symbol and c.observed_at=b.observed_at and c.model_version=${CHALLENGER_VERSION}
    join forecast_ledger f1 on f1.id=b.forecast_id
    join forecast_ledger f2 on f2.id=c.forecast_id
    join forecast_outcomes o1 on o1.forecast_id=f1.id
    join forecast_outcomes o2 on o2.forecast_id=f2.id
    where b.model_version=${BASELINE_VERSION}
      and b.observed_at>=${TRIAL_ACTIVATION}::timestamptz
      and b.recorded_at>=${TRIAL_ACTIVATION}::timestamptz
      and c.recorded_at>=${TRIAL_ACTIVATION}::timestamptz
      and o1.was_correct is not null and o2.was_correct is not null
    order by b.recorded_at asc limit 10000
  `;
  let disagreeing=0;const paired=[];
  for(const row of rows as any[]){
    if(Boolean(row.baseline_outcome)!==Boolean(row.challenger_outcome)){disagreeing++;continue}
    paired.push({timestamp:new Date(row.observed_at).toISOString(),symbol:String(row.symbol),
      baselineP:Number(row.baseline_probability),challengerP:Number(row.challenger_probability),
      outcome:(row.baseline_outcome?1:0) as 0|1});
  }
  return NextResponse.json({trial:{baseline:BASELINE_VERSION,challenger:CHALLENGER_VERSION,
    frozenAt:"2026-10-18",activatedAt:TRIAL_ACTIVATION,outcomeDisagreements:disagreeing,
    ...evaluateProspectivePairs(paired)},status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),
    noAutomaticPromotion:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",reason:"Paired outcome trial could not be retrieved"},{status:503})}
}
