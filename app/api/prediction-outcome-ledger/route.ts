import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {PREDICTION_OUTCOME_RULE_VERSION,predictionOutcomeVerdict} from "../../../lib/research/prediction-outcome-verdict";
import {horizonMs} from "../../../lib/market/horizon";
import {sourceTimeCertificateCovers,type SourceTimeCertificate} from "../../../lib/research/source-time-certification";
export const dynamic="force-dynamic";

function protocol(notes:unknown){try{const parsed=JSON.parse(String(notes??""));return parsed?.ruleVersion===PREDICTION_OUTCOME_RULE_VERSION?parsed:null;}catch{return null;}}
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
  const entries=(rows as any[]).map(row=>{
   const p=protocol(row.notes),cost=p?.quotedRoundTripCost==null?(row.reconstructed_cost==null?null:Number(row.reconstructed_cost)):Number(p.quotedRoundTripCost);
   const forecastAt=new Date(row.created_at).toISOString(),sourceId=String(p?.sourceId??row.reconstructed_source_id??""),duration=horizonMs(String(row.horizon));
   const startTime=Date.parse(String(p?.startObservationTime??"")),evaluationTime=Date.parse(String(p?.evaluationObservationTime??"")),forecastTime=Date.parse(forecastAt);
   const completeProtocol=Boolean(p?.ruleVersion===PREDICTION_OUTCOME_RULE_VERSION&&sourceId&&duration&&Number.isFinite(startTime)&&Number.isFinite(evaluationTime)&&startTime>=forecastTime&&startTime<=forecastTime+5*60_000&&evaluationTime>=forecastTime+duration&&evaluationTime<=forecastTime+duration+15*60_000);
   const sourceTimeCertified=completeProtocol&&certificates.some(c=>sourceTimeCertificateCovers(sourceId,forecastAt,c));
   const outcomeTime=completeProtocol?new Date(evaluationTime).toISOString():row.resolved_at?new Date(row.resolved_at).toISOString():null;
   const verdict=predictionOutcomeVerdict({direction:String(row.direction),forecastAt,resolvedAt:outcomeTime,realizedReturn:row.realized_return==null?null:Number(row.realized_return),quotedRoundTripCost:cost});
   return{id:String(row.id),forecastAt,symbol:String(row.symbol),horizon:String(row.horizon),modelVersion:String(row.model_version),direction:String(row.direction),probability:Number(row.probability),resolvedAt:outcomeTime,realizedReturn:row.realized_return==null?null:Number(row.realized_return),maximumFavorableExcursion:row.max_favorable_excursion==null?null:Number(row.max_favorable_excursion),maximumAdverseExcursion:row.max_adverse_excursion==null?null:Number(row.max_adverse_excursion),quotedRoundTripCost:cost,...verdict,evidenceClass:completeProtocol?"PROSPECTIVE_PROTOCOL":"HISTORICAL_RECONSTRUCTION",scientificallyEligible:completeProtocol&&sourceTimeCertified&&(verdict.verdict==="PASS"||verdict.verdict==="FAIL"),sourceTimeCertified,sourceId:sourceId||null};
  });
  const count=(verdict:string,eligible?:boolean)=>entries.filter(x=>x.verdict===verdict&&(eligible===undefined||x.scientificallyEligible===eligible)).length;
  const resolved=entries.filter(x=>x.verdict==="PASS"||x.verdict==="FAIL"),eligible=entries.filter(x=>x.scientificallyEligible),uniqueTests=new Set(entries.map(x=>`${x.symbol}|${x.horizon}|${x.forecastAt.slice(0,16)}`)).size;
  const byModel=[...new Set(entries.map(x=>x.modelVersion))].map(modelVersion=>{const xs=entries.filter(x=>x.modelVersion===modelVersion&&(x.verdict==="PASS"||x.verdict==="FAIL"));return{modelVersion,resolved:xs.length,passes:xs.filter(x=>x.verdict==="PASS").length,passRate:xs.length?xs.filter(x=>x.verdict==="PASS").length/xs.length:null};});
  return NextResponse.json({status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),rule:{version:PREDICTION_OUTCOME_RULE_VERSION,pass:"direction-adjusted realized return minus recorded quoted round-trip cost >= 0.001",fail:"a mature valid outcome that misses the pass threshold",void:"invalid chronology, unsupported direction, non-finite return, or unavailable quoted cost",unresolved:"evaluation horizon has not produced an outcome"},summary:{predictions:entries.length,uniqueMarketTests:uniqueTests,resolved:resolved.length,passes:count("PASS"),failures:count("FAIL"),voids:count("VOID"),unresolved:count("UNRESOLVED"),passRate:resolved.length?count("PASS")/resolved.length:null,prospectiveScientificRecords:eligible.length,prospectiveScientificPasses:count("PASS",true),sessions:new Set(eligible.map(x=>x.forecastAt.slice(0,10))).size},byModel,recent:entries.slice(0,250),scientificPolicy:"Objective market outcomes are the factual source. Scientific eligibility additionally requires a prediction frozen before the outcome, a versioned rule, complete start/end observation provenance, and recorded cost. Historical reconstructions remain evidence but cannot be relabeled as prospective."},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({status:"UNAVAILABLE",reason:error instanceof Error?error.message:"Scientific ledger unavailable"},{status:503});}
}
