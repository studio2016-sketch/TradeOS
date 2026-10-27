import {createHash} from "node:crypto";

export const PREDICTION_OUTCOME_RULE_VERSION="tradeos.prediction-outcome.v1";
export const PREDICTION_OUTCOME_PROTOCOL_ACTIVATION="2026-10-27T07:16:00.000Z";
export const PREDICTION_OUTCOME_PROTOCOL={
 schema:"tradeos.prediction-outcome.protocol.v1",
 ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,
 activation:PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,
 supportedDirections:["bullish","bearish"],
 minimumNetEdge:.001,
 startObservationToleranceMs:5*60_000,
 evaluationGraceMs:15*60_000,
 returnMethod:"same-feed midpoint return from the first valid post-forecast quote to the first quote at or after the exact horizon",
 costMethod:"full quoted spread at the recorded start observation",
 passRule:"direction-adjusted realized return minus recorded quoted round-trip cost is at least minimumNetEdge",
 sourceTimeRule:"the source-time certificate must exist at prediction time and cover the recorded provider feed",
 invalidDataRule:"fail closed to VOID; missing outcomes remain UNRESOLVED"
} as const;
export const PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT=createHash("sha256").update(JSON.stringify(PREDICTION_OUTCOME_PROTOCOL)).digest("hex");
export type ScientificVerdict="PASS"|"FAIL"|"VOID"|"UNRESOLVED";
export type PredictionOutcomeInput={
 direction:string;forecastAt:string;resolvedAt:string|null;realizedReturn:number|null;
 quotedRoundTripCost:number|null;minimumNetEdge?:number;
};

export function predictionOutcomeVerdict(input:PredictionOutcomeInput){
 const minimumNetEdge=input.minimumNetEdge??.001;
 const forecast=Date.parse(input.forecastAt),resolved=input.resolvedAt?Date.parse(input.resolvedAt):NaN;
 const protocolFingerprint=PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT;
 if(input.resolvedAt===null||input.realizedReturn===null)return{verdict:"UNRESOLVED" as ScientificVerdict,reason:"outcome_not_mature",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint};
 if(!Number.isFinite(forecast)||!Number.isFinite(resolved)||resolved<forecast)return{verdict:"VOID" as ScientificVerdict,reason:"invalid_outcome_chronology",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint};
 if(!Number.isFinite(input.realizedReturn))return{verdict:"VOID" as ScientificVerdict,reason:"invalid_realized_return",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint};
 if(input.quotedRoundTripCost===null||!Number.isFinite(input.quotedRoundTripCost)||input.quotedRoundTripCost<0)return{verdict:"VOID" as ScientificVerdict,reason:"quoted_cost_unavailable",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint};
 if(!Number.isFinite(minimumNetEdge)||minimumNetEdge<0)return{verdict:"VOID" as ScientificVerdict,reason:"invalid_edge_threshold",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint};
 const direction=input.direction.toLowerCase();
 if(direction!=="bullish"&&direction!=="bearish")return{verdict:"VOID" as ScientificVerdict,reason:"unsupported_direction",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint};
 const grossDirectionalReturn=direction==="bearish"?-input.realizedReturn:input.realizedReturn;
 const netReturn=grossDirectionalReturn-input.quotedRoundTripCost;
 return{verdict:(netReturn>=minimumNetEdge?"PASS":"FAIL") as ScientificVerdict,reason:netReturn>=minimumNetEdge?"net_edge_met":"net_edge_missed",grossDirectionalReturn,netReturn,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint};
}
