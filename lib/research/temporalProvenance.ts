export type ProvenanceRecord={forecastTime:string;resolvedAt:string|null;sourceSnapshot:unknown;evidence:unknown;modelVersion:string};
export function auditForecastProvenance(rows:ProvenanceRecord[]){
 const diagnostics={total:rows.length,missingOutcomeTime:0,outcomeBeforeForecast:0,missingSourceTime:0,futureSourceTime:0,parseableSourceTime:0,missingEvidence:0,models:{} as Record<string,number>};
 const knownKeys=new Set(["timestamp","observedAt","event_time","eventTime","publishedAt","observationTime","asOf","lastUpdated","sourceTimestamp"]);
 function collect(value:unknown,depth=0,found:string[]=[]):string[]{
  if(depth>8||!value||typeof value!=="object")return found;
  for(const [key,v] of Object.entries(value)){
   if(knownKeys.has(key)&&typeof v==="string"&&Number.isFinite(Date.parse(v)))found.push(v);
   if(v&&typeof v==="object")collect(v,depth+1,found);
  }
  return found;
 }
 for(const row of rows){
  diagnostics.models[row.modelVersion]=(diagnostics.models[row.modelVersion]||0)+1;
  const forecast=Date.parse(row.forecastTime),resolved=Date.parse(row.resolvedAt||"");
  if(!Number.isFinite(resolved))diagnostics.missingOutcomeTime++;
  else if(Number.isFinite(forecast)&&resolved<forecast)diagnostics.outcomeBeforeForecast++;
  if(!Array.isArray(row.evidence)||!row.evidence.length)diagnostics.missingEvidence++;
  const times=collect(row.sourceSnapshot);
  if(!times.length)diagnostics.missingSourceTime++;
  else{diagnostics.parseableSourceTime++;if(times.some(t=>Date.parse(t)>forecast+60000))diagnostics.futureSourceTime++}
 }
 return {...diagnostics,independentFactorCertification:false,adaptiveChangeCertification:false,historicalReconciliationComplete:false,readyForModelPromotion:false,
 reasons:["Source timestamp presence alone does not prove that source snapshots were actually frozen at prediction time.","Folds are not independently instrument-grouped or purged for overlapping future-return labels.","No immutable before/after adaptive policy versions and paired frozen holdouts were verified.","Corporate actions, fees, portfolio cashflows, fills, and orderbook conditions have not been reconciled."]};
}
