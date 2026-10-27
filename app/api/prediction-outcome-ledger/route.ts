import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {PREDICTION_OUTCOME_PROTOCOL,PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,PREDICTION_OUTCOME_RULE_VERSION} from "../../../lib/research/prediction-outcome-verdict";
import {evaluatePredictionOutcomeRow,summarizePredictionOutcomeEntries} from "../../../lib/research/prediction-outcome-ledger";
import {discoverHistoricalFactorAssociations} from "../../../lib/research/historical-factor-discovery";
import type {SourceTimeCertificate} from "../../../lib/research/source-time-certification";
export const dynamic="force-dynamic";

export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",reason:"Scientific ledger database unavailable"},{status:503});
 try{
  const sql=db();
  const [rows,certificateRows]=await Promise.all([sql`select f.id,f.created_at,f.symbol,f.horizon,f.model_version,f.direction,f.probability,
    o.resolved_at,o.realized_return,o.max_favorable_excursion,o.max_adverse_excursion,o.notes,
    q.source_id as reconstructed_source_id,q.event_time as reconstructed_quote_time,
    case when (q.metadata->>'ask')::float8>(q.metadata->>'bid')::float8 and (q.metadata->>'bid')::float8>0
      then ((q.metadata->>'ask')::float8-(q.metadata->>'bid')::float8)/(((q.metadata->>'ask')::float8+(q.metadata->>'bid')::float8)/2) else null end reconstructed_cost
   from forecast_ledger f left join forecast_outcomes o on o.forecast_id=f.id
   left join lateral(select source_id,event_time,metadata from source_observations
     where data_class='market_snapshot' and symbol=f.symbol and event_time<=f.created_at and event_time>=f.created_at-interval '15 minutes'
     order by event_time desc limit 1) q on true
   order by f.created_at desc limit 5000`,sql`select provider,feed,certification_kind,valid_from,valid_to,created_at from tradeos_source_time_certifications order by created_at`]);
  const certificates:SourceTimeCertificate[]=(certificateRows as any[]).map(row=>({provider:String(row.provider),feed:String(row.feed),certification_kind:String(row.certification_kind),valid_from:new Date(row.valid_from).toISOString(),valid_to:row.valid_to?new Date(row.valid_to).toISOString():null,created_at:new Date(row.created_at).toISOString()}));
  const entries=(rows as any[]).map(row=>evaluatePredictionOutcomeRow(row,certificates));
  const summary=summarizePredictionOutcomeEntries(entries),eligible=entries.filter(x=>x.scientificallyEligible);
  const byModel=[...new Set(entries.map(x=>x.modelVersion))].map(modelVersion=>{const xs=entries.filter(x=>x.modelVersion===modelVersion&&(x.verdict==="PASS"||x.verdict==="FAIL"));return{modelVersion,resolved:xs.length,passes:xs.filter(x=>x.verdict==="PASS").length,passRate:xs.length?xs.filter(x=>x.verdict==="PASS").length/xs.length:null};});
  let prospectiveFactorAssociations={testedFamilySize:0,multiplicityMethod:"Holm-Bonferroni",findings:[] as any[],policy:"No scientifically eligible prospective outcomes are available yet."};
  if(eligible.length){
   const factorRows=await sql`select f.id as forecast_id,f.created_at,e.factor_key,e.value
    from forecast_ledger f join lateral(
     select distinct on(factor_key) factor_key,value from tradeos_factor_evidence
     where observed_at<=f.created_at and available_at<=f.created_at and (subject=f.symbol or domain='macro')
     order by factor_key,available_at desc,id desc
    ) e on true where f.created_at>=${PREDICTION_OUTCOME_PROTOCOL_ACTIVATION}::timestamptz limit 250000`;
   const eligibleById=new Map(eligible.map(x=>[x.id,x]));
   const seen=new Set<string>();
   const records=(factorRows as any[]).flatMap(row=>{const entry=eligibleById.get(String(row.forecast_id));if(!entry)return[];const key=`${entry.symbol}|${entry.horizon}|${entry.forecastAt.slice(0,16)}|${String(row.factor_key)}`;if(seen.has(key))return[];seen.add(key);return[{time:entry.forecastAt,symbol:entry.symbol,horizon:entry.horizon,label:String(row.factor_key),value:Number(row.value),signedReturn:entry.verdict==="PASS"?1:0}];});
   const discovered=discoverHistoricalFactorAssociations(records);
   prospectiveFactorAssociations={...discovered,policy:"Prospective point-in-time association between factor values and fingerprint-bound PASS/FAIL outcomes. Results remain hypotheses; no factor is promoted from association alone."};
  }
  return NextResponse.json({status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),rule:{version:PREDICTION_OUTCOME_RULE_VERSION,activation:PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,fingerprint:PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,protocol:PREDICTION_OUTCOME_PROTOCOL,pass:"direction-adjusted realized return minus recorded quoted round-trip cost >= 0.001",fail:"a mature valid outcome that misses the pass threshold",void:"invalid chronology, unsupported direction, non-finite return, or unavailable quoted cost",unresolved:"evaluation horizon has not produced an outcome"},summary,byModel,prospectiveFactorAssociations,recent:entries.slice(0,250),scientificPolicy:"Objective market outcomes are the factual source. Scientific eligibility additionally requires a prediction frozen after protocol activation and before the outcome, the exact protocol fingerprint, complete same-feed start/end provenance, certified source-time semantics, and recorded cost. Factor associations remain hypotheses until prospective depth, chronological stability, family-wide multiplicity control, skill, and execution gates all pass."},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({status:"UNAVAILABLE",reason:error instanceof Error?error.message:"Scientific ledger unavailable"},{status:503});}
}
