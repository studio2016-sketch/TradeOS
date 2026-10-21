import {auditEvidence,type Evidence} from "./source-vintage-audit";
type Row={symbol:string;market_time:string;recorded_at:string;provider:string;features:Record<string,number|null>};
const immediate=new Set(["daily_volume","bid_ask_spread","spread_bps","quoted_depth","order_imbalance","distance_vwap"]);
export function marketEvidenceFromRows(rows:Row[],cutoff:string){
 const evidence:Evidence[]=[];
 for(const row of rows){
  const observed=Date.parse(row.market_time),available=Date.parse(row.recorded_at);
  if(!Number.isFinite(observed)||!Number.isFinite(available)||observed>available)continue;
  for(const [factor,value] of Object.entries(row.features)){
   if(!immediate.has(factor)||typeof value!=="number"||!Number.isFinite(value))continue;
   evidence.push({factor,value,domain:"stock",source:row.provider,observedAt:row.market_time,availableAt:row.recorded_at,subject:row.symbol});
  }
 }
 return auditEvidence(evidence,cutoff);
}
