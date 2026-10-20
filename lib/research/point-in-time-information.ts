import {compareInformationValue} from "./information-value";
export type AsOfRow={timestamp:string;decisionTime:string;priceObservedAt:string;macroObservedAt:string;newsObservedAt:string|null;baselineLoss:number;macroLoss:number;newsLoss:number;baselineNet:number;macroNet:number;newsNet:number};
export function evaluatePointInTimeInformation(rows:AsOfRow[]){
 const failures:string[]=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i],decision=Date.parse(row.decisionTime);
  if(!Number.isFinite(decision))failures.push("Missing decision time at "+i);
  for(const key of ["priceObservedAt","macroObservedAt","newsObservedAt"] as const){
   const value=row[key];
   if(key==="newsObservedAt"&&value===null)continue;
   const observed=Date.parse(value??"");
   if(!Number.isFinite(observed)||observed>decision)failures.push("Unusable "+key+" at observation "+i);
  }
  if(Date.parse(row.timestamp)<decision)failures.push("Outcome timestamp precedes decision at "+i);
 }
 if(failures.length)return {evaluated:false,failures:failures.slice(0,50),tradeAuthorized:false};
 const result=compareInformationValue(rows);
 return {evaluated:true,failures:[],result,tradeAuthorized:false,warning:"Timestamp declarations require independent source-vintage audits. This check alone cannot certify a point-in-time dataset."};
}
