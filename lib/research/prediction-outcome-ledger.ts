import {horizonMs} from "../market/horizon";
import {
 PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,
 PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,
 PREDICTION_OUTCOME_RULE_VERSION,
 predictionOutcomeVerdict
} from "./prediction-outcome-verdict";
import {sourceTimeCertificateCovers,type SourceTimeCertificate} from "./source-time-certification";

export type PredictionOutcomeLedgerRow={
 id:unknown;created_at:unknown;symbol:unknown;horizon:unknown;model_version:unknown;direction:unknown;probability:unknown;
 resolved_at:unknown;realized_return:unknown;max_favorable_excursion:unknown;max_adverse_excursion:unknown;notes:unknown;
 reconstructed_source_id?:unknown;reconstructed_cost?:unknown;
};

function protocol(notes:unknown){
 try{const parsed=JSON.parse(String(notes??""));return parsed?.ruleVersion===PREDICTION_OUTCOME_RULE_VERSION?parsed:null;}catch{return null;}
}

export function evaluatePredictionOutcomeRow(row:PredictionOutcomeLedgerRow,certificates:SourceTimeCertificate[]){
 const p=protocol(row.notes);
 const cost=p?.quotedRoundTripCost==null?(row.reconstructed_cost==null?null:Number(row.reconstructed_cost)):Number(p.quotedRoundTripCost);
 const forecastAt=new Date(row.created_at as string).toISOString(),sourceId=String(p?.sourceId??row.reconstructed_source_id??""),duration=horizonMs(String(row.horizon));
 const startTime=Date.parse(String(p?.startObservationTime??"")),evaluationTime=Date.parse(String(p?.evaluationObservationTime??"")),forecastTime=Date.parse(forecastAt);
 const fingerprintRecorded=p?.protocolFingerprint===PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT;
 const completeProtocol=Boolean(
  forecastTime>=Date.parse(PREDICTION_OUTCOME_PROTOCOL_ACTIVATION)&&p?.ruleVersion===PREDICTION_OUTCOME_RULE_VERSION&&fingerprintRecorded&&sourceId&&duration&&
  Number.isFinite(startTime)&&Number.isFinite(evaluationTime)&&startTime>=forecastTime&&startTime<=forecastTime+5*60_000&&
  evaluationTime>=forecastTime+duration&&evaluationTime<=forecastTime+duration+15*60_000
 );
 const sourceTimeCertified=completeProtocol&&certificates.some(c=>sourceTimeCertificateCovers(sourceId,forecastAt,c));
 const outcomeTime=completeProtocol?new Date(evaluationTime).toISOString():row.resolved_at?new Date(row.resolved_at as string).toISOString():null;
 const verdict=predictionOutcomeVerdict({direction:String(row.direction),forecastAt,resolvedAt:outcomeTime,realizedReturn:row.realized_return==null?null:Number(row.realized_return),quotedRoundTripCost:cost});
 return{
  id:String(row.id),forecastAt,symbol:String(row.symbol),horizon:String(row.horizon),modelVersion:String(row.model_version),direction:String(row.direction),probability:Number(row.probability),
  resolvedAt:outcomeTime,realizedReturn:row.realized_return==null?null:Number(row.realized_return),
  maximumFavorableExcursion:row.max_favorable_excursion==null?null:Number(row.max_favorable_excursion),maximumAdverseExcursion:row.max_adverse_excursion==null?null:Number(row.max_adverse_excursion),
  quotedRoundTripCost:cost,...verdict,evidenceClass:completeProtocol?"PROSPECTIVE_PROTOCOL":"HISTORICAL_RECONSTRUCTION",
  scientificallyEligible:completeProtocol&&sourceTimeCertified&&(verdict.verdict==="PASS"||verdict.verdict==="FAIL"),sourceTimeCertified,fingerprintRecorded,sourceId:sourceId||null
 };
}

export type PredictionOutcomeEntry=ReturnType<typeof evaluatePredictionOutcomeRow>;

export function summarizePredictionOutcomeEntries(entries:PredictionOutcomeEntry[]){
 const count=(verdict:string,eligible?:boolean)=>entries.filter(x=>x.verdict===verdict&&(eligible===undefined||x.scientificallyEligible===eligible)).length;
 const resolved=entries.filter(x=>x.verdict==="PASS"||x.verdict==="FAIL"),eligible=entries.filter(x=>x.scientificallyEligible);
 return{
  predictions:entries.length,
  uniqueMarketTests:new Set(entries.map(x=>`${x.symbol}|${x.horizon}|${x.forecastAt.slice(0,16)}`)).size,
  resolved:resolved.length,passes:count("PASS"),failures:count("FAIL"),voids:count("VOID"),unresolved:count("UNRESOLVED"),
  passRate:resolved.length?count("PASS")/resolved.length:null,
  prospectiveScientificRecords:eligible.length,prospectiveScientificPasses:count("PASS",true),prospectiveScientificFailures:count("FAIL",true),
  fingerprintedScientificRecords:eligible.filter(x=>x.fingerprintRecorded).length,
  sessions:new Set(eligible.map(x=>x.forecastAt.slice(0,10))).size
 };
}

