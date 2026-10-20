export type Lead={id:string;headline:string;publishedAt:string;observedAt:string;sourceFamily:string;otherSourceFamilies:string[];symbols:string[];mechanism:string;novelty:number;materiality:number;quality:number;relevance:number;urgency:number;contradictions:number};
export function scoreLead(x:Lead,now:string){
 const issues:string[]=[];const p=Date.parse(x.publishedAt),o=Date.parse(x.observedAt),n=Date.parse(now);
 if(!x.id||!x.headline||!x.sourceFamily)issues.push("Missing provenance");
 if(!Number.isFinite(p)||!Number.isFinite(o)||!Number.isFinite(n)||p>o||o>n+5000)issues.push("Invalid chronology");
 if(!x.mechanism||!x.symbols.length)issues.push("Missing falsifiable impact hypothesis");
 if(!x.otherSourceFamilies.some(s=>s!==x.sourceFamily))issues.push("No independent corroboration");
 for(const k of ["novelty","materiality","quality","relevance","urgency"] as const)if(!Number.isFinite(x[k])||x[k]<0||x[k]>100)issues.push("Invalid "+k);
 if(!Number.isSafeInteger(x.contradictions)||x.contradictions<0)issues.push("Invalid contradictions");
 const score=issues.length?null:Math.max(0,Math.round((.2*x.novelty+.3*x.materiality+.25*x.quality+.15*x.relevance+.1*x.urgency-Math.min(25,x.contradictions*5))*10)/10);
 return {score,issues,action:score===null?"QUARANTINE":score>=75?"INVESTIGATE":score>=50?"MONITOR":"DEFER",predictionApproved:false,tradeAuthorized:false};
}
