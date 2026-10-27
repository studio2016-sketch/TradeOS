export const PREDICTION_OUTCOME_RULE_VERSION="tradeos.prediction-outcome.v1";
export type ScientificVerdict="PASS"|"FAIL"|"VOID"|"UNRESOLVED";
export type PredictionOutcomeInput={
 direction:string;forecastAt:string;resolvedAt:string|null;realizedReturn:number|null;
 quotedRoundTripCost:number|null;minimumNetEdge?:number;
};

export function predictionOutcomeVerdict(input:PredictionOutcomeInput){
 const minimumNetEdge=input.minimumNetEdge??.001;
 const forecast=Date.parse(input.forecastAt),resolved=input.resolvedAt?Date.parse(input.resolvedAt):NaN;
 if(input.resolvedAt===null||input.realizedReturn===null)return{verdict:"UNRESOLVED" as ScientificVerdict,reason:"outcome_not_mature",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION};
 if(!Number.isFinite(forecast)||!Number.isFinite(resolved)||resolved<forecast)return{verdict:"VOID" as ScientificVerdict,reason:"invalid_outcome_chronology",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION};
 if(!Number.isFinite(input.realizedReturn))return{verdict:"VOID" as ScientificVerdict,reason:"invalid_realized_return",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION};
 if(input.quotedRoundTripCost===null||!Number.isFinite(input.quotedRoundTripCost)||input.quotedRoundTripCost<0)return{verdict:"VOID" as ScientificVerdict,reason:"quoted_cost_unavailable",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION};
 if(!Number.isFinite(minimumNetEdge)||minimumNetEdge<0)return{verdict:"VOID" as ScientificVerdict,reason:"invalid_edge_threshold",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION};
 const direction=input.direction.toLowerCase();
 if(direction!=="bullish"&&direction!=="bearish")return{verdict:"VOID" as ScientificVerdict,reason:"unsupported_direction",grossDirectionalReturn:null,netReturn:null,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION};
 const grossDirectionalReturn=direction==="bearish"?-input.realizedReturn:input.realizedReturn;
 const netReturn=grossDirectionalReturn-input.quotedRoundTripCost;
 return{verdict:(netReturn>=minimumNetEdge?"PASS":"FAIL") as ScientificVerdict,reason:netReturn>=minimumNetEdge?"net_edge_met":"net_edge_missed",grossDirectionalReturn,netReturn,minimumNetEdge,ruleVersion:PREDICTION_OUTCOME_RULE_VERSION};
}
