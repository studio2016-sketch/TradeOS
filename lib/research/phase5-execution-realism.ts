export const EXECUTION_REALISM_IMPLEMENTATION="quoted-spread-and-fill-slippage-v1" as const;

export type ExecutionResearchRow={
 time:string;direction:"bullish"|"bearish";realizedReturn:number;spreadFraction:number;
};
function mean(xs:number[]){return xs.reduce((a,b)=>a+b,0)/xs.length;}
export function evaluateExecutionCostResearch(raw:ExecutionResearchRow[],empiricalRoundTripSlippageFraction=0){
 const extra=Number.isFinite(empiricalRoundTripSlippageFraction)&&empiricalRoundTripSlippageFraction>=0?empiricalRoundTripSlippageFraction:0;
 const rows=raw.filter(r=>Number.isFinite(Date.parse(r.time))&&Number.isFinite(r.realizedReturn)&&Number.isFinite(r.spreadFraction)&&r.spreadFraction>=0&&r.spreadFraction<=.1);
 if(!rows.length)return {samples:0,sessions:0,meanGross:null,meanQuotedRoundTripSpreadCost:null,meanNetAfterQuotedSpread:null,clustered95:[null,null] as [number|null,number|null],lowerBound:null,mature:false,executionSlippageValidated:false};
 const bySession=new Map<string,number[]>();
 const gross:number[]=[],cost:number[]=[],netQuoted:number[]=[],netAll:number[]=[];
 for(const r of rows){
  const directional=(r.direction==="bearish"?-1:1)*r.realizedReturn;
  // Entering at the adverse side of the quote and exiting across a comparable spread
  // costs roughly one full quoted spread versus midpoint-to-midpoint return.
  const quotedRoundTrip=Math.max(0,r.spreadFraction);
  const afterQuoted=directional-quotedRoundTrip;
  const after=afterQuoted-extra;
  gross.push(directional);cost.push(quotedRoundTrip);netQuoted.push(afterQuoted);netAll.push(after);
  const day=new Date(r.time).toISOString().slice(0,10),xs=bySession.get(day)??[];xs.push(after);bySession.set(day,xs);
 }
 const sessions=[...bySession.values()];
 let lower:number|null=null,upper:number|null=null;
 if(sessions.length>=2){
  let state=2166136261>>>0;const draws:number[]=[];const rounds=4000;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let k=0;k<rounds;k++){
   const sampled:number[]=[];
   for(let i=0;i<sessions.length;i++)sampled.push(...sessions[Math.floor(rand()*sessions.length)]);
   draws.push(mean(sampled));
  }
  draws.sort((a,b)=>a-b);lower=draws[Math.floor(.025*(rounds-1))];upper=draws[Math.floor(.975*(rounds-1))];
 }
 return {
  samples:rows.length,sessions:sessions.length,meanGross:mean(gross),meanQuotedRoundTripSpreadCost:mean(cost),
  meanNetAfterQuotedSpread:mean(netQuoted),empiricalRoundTripSlippageFraction:extra,meanNetAfterAllModeledCosts:mean(netAll),clustered95:[lower,upper] as [number|null,number|null],lowerBound:lower,
  mature:rows.length>=200&&sessions.length>=20&&lower!==null&&lower>0,
  executionSlippageValidated:false,
  policy:extra>0?"Quoted spread plus empirically supplied conservative round-trip slippage penalty. Certification still requires the supplied fill-slippage evidence itself to be independently qualified.":"Quoted-spread stress test only. It is not actual execution slippage and cannot satisfy the fill-slippage certification gate."
 };
}

export type FillSlippageRow={time:string;side:"buy"|"sell";fillPrice:number;referenceBid:number;referenceAsk:number;quantity:number};
export function validateFillSlippage(raw:FillSlippageRow[]){
 const rows=raw.filter(r=>Number.isFinite(Date.parse(r.time))&&r.fillPrice>0&&r.referenceBid>0&&r.referenceAsk>=r.referenceBid&&r.quantity>0);
 const values=rows.map(r=>{
  const mid=(r.referenceBid+r.referenceAsk)/2;
  const adverse=r.side==="buy"?(r.fillPrice-mid)/mid:(mid-r.fillPrice)/mid;
  return {time:r.time,slippageBps:adverse*10000,quantity:r.quantity};
 });
 const bySession=new Map<string,typeof values>();
 for(const v of values){const day=new Date(v.time).toISOString().slice(0,10),xs=bySession.get(day)??[];xs.push(v);bySession.set(day,xs);}
 const sessions=bySession.size;
 const weightedQty=values.reduce((s,v)=>s+v.quantity,0);
 const weightedBps=weightedQty?values.reduce((s,v)=>s+v.slippageBps*v.quantity,0)/weightedQty:null;
 let upper95Bps:number|null=null;
 if(sessions>=2){
  let state=2654435761>>>0;const draws:number[]=[];const groups=[...bySession.values()];const rounds=4000;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let k=0;k<rounds;k++){
   const sample:typeof values=[];
   for(let i=0;i<groups.length;i++)sample.push(...groups[Math.floor(rand()*groups.length)]);
   const qty=sample.reduce((s,v)=>s+v.quantity,0);
   if(qty>0)draws.push(sample.reduce((s,v)=>s+v.slippageBps*v.quantity,0)/qty);
  }
  draws.sort((a,b)=>a-b);if(draws.length)upper95Bps=draws[Math.floor(.95*(draws.length-1))];
 }
 return {fills:values.length,sessions,volumeWeightedSlippageBps:weightedBps,upper95Bps,conservativeRoundTripSlippageFraction:upper95Bps==null?null:Math.max(0,upper95Bps)*2/10000,validated:values.length>=30&&sessions>=5&&upper95Bps!==null,rows:values};
}
