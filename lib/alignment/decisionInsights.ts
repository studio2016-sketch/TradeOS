/** Deterministic, evidence-linked explanations. No invented probabilities or forecasts. */
export type InsightReading={id:string;label:string;group:string;state:string;buyScore:number|null;criticalBuy?:boolean;source?:string;freshness?:string;note?:string};
export function buildDecisionInsights(input:{
 readings:InsightReading[]; buyState:string; observedCount:number; criticalPassed:number;criticalTotal:number;
 sourceDecisionGrade:boolean; independentOosVerified:boolean; vetoes:string[]; 
}){
 const severity=(s:string)=>s==="misaligned"?3:s==="unavailable"?2:s==="mixed"?1:0;
 const blockers=input.readings.filter(r=>r.state!=="aligned")
  .sort((a,b)=>Number(Boolean(b.criticalBuy))-Number(Boolean(a.criticalBuy))||severity(b.state)-severity(a.state)||a.label.localeCompare(b.label))
  .slice(0,6).map(r=>({id:r.id,label:r.label,group:r.group,state:r.state,critical:Boolean(r.criticalBuy),source:r.source??"Unknown",note:r.note??"",reason:r.state==="unavailable"?"Supporting evidence is unavailable.":r.state==="mixed"?"Evidence is inconclusive.":"Observed conditions do not meet alignment criteria."}));
 const strengths=input.readings.filter(r=>r.state==="aligned")
  .sort((a,b)=>Number(Boolean(b.criticalBuy))-Number(Boolean(a.criticalBuy))||(b.buyScore??0)-(a.buyScore??0))
  .slice(0,4).map(r=>({id:r.id,label:r.label,group:r.group,score:r.buyScore,source:r.source??"Unknown"}));
 const gates=[
  {id:"market_data",pass:input.sourceDecisionGrade,explanation:input.sourceDecisionGrade?"Source coverage has passed the configured research-grade test.":"Consolidated independently trusted market data is not yet established."},
  {id:"research_certification",pass:input.independentOosVerified,explanation:input.independentOosVerified?"Independent out-of-sample checks reported passed.":"Research has not passed all independent chronological validation requirements."},
  {id:"critical_market_checks",pass:input.criticalTotal>0&&input.criticalPassed===input.criticalTotal,explanation:input.criticalTotal?input.criticalPassed+" of "+input.criticalTotal+" critical checks passed.":"Critical checks unavailable."},
  {id:"decision_council",pass:input.vetoes.length===0,explanation:input.vetoes.length?input.vetoes.length+" active objections prevent elevation.":"No active Council veto reported."}
 ];
 return {mode:"deterministic_explanation",predictionProbability:null,
  conclusion:input.buyState,observedMarketGears:input.observedCount,
  strengths,blockers,gates,unmetGates:gates.filter(g=>!g.pass).map(g=>g.id),
  explanation:"Alignment is a research score, not a calibrated chance of profit. Unmet evidence or governance checks prevent treating this as an executable recommendation."
 };
}
