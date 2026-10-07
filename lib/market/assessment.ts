import type {Assessment,Evidence,EvidenceDirection} from "./types";
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
export function assess(evidence:Evidence[]):Assessment{
 if(!evidence.length)return{score:50,confidence:0,uncertainty:100,direction:"neutral",decision:"pass",agreement:0,dataQuality:0,evidence,reasons:[],warnings:["No evidence available"]};
 const usable=evidence.filter(e=>e.quality>0&&e.freshness>0);
 const weight=(e:Evidence)=>Math.max(.01,e.quality*e.freshness*e.independence);
 const signed=(e:Evidence)=>e.direction==="bullish"?1:e.direction==="bearish"?-1:0;
 const total=usable.reduce((s,e)=>s+weight(e),0)||1;
 const directional=usable.reduce((s,e)=>s+signed(e)*e.value*weight(e),0)/total;
 const score=clamp(50+directional/2);
 const bullishW=usable.filter(e=>e.direction==="bullish").reduce((s,e)=>s+weight(e),0);
 const bearishW=usable.filter(e=>e.direction==="bearish").reduce((s,e)=>s+weight(e),0);
 const neutralW=usable.filter(e=>e.direction==="neutral"||e.direction==="mixed").reduce((s,e)=>s+weight(e),0);
 const agreement=clamp(Math.max(bullishW,bearishW,neutralW)/total*100);
 const dataQuality=clamp((usable.reduce((s,e)=>s+e.quality*e.freshness,0)/usable.length)*100);
 const uncertainty=clamp(100-(agreement*.55+dataQuality*.45));
 const confidence=clamp(100-uncertainty);
 let direction:EvidenceDirection="neutral";
 if(score>=58)direction="bullish"; else if(score<=42)direction="bearish"; else if(agreement<55)direction="mixed";
 const warnings:string[]=[];
 if(dataQuality<70)warnings.push("Data quality below operating threshold");
 if(agreement<60)warnings.push("Independent signals disagree");
 if(usable.some(e=>e.freshness<.7))warnings.push("One or more inputs are stale");
 const decision:Assessment["decision"]=confidence<68||warnings.length>=2?"pass":confidence<78?"wait":"consider";
 return{score:+score.toFixed(1),confidence:+confidence.toFixed(1),uncertainty:+uncertainty.toFixed(1),direction,decision,agreement:+agreement.toFixed(1),dataQuality:+dataQuality.toFixed(1),evidence,reasons:usable.sort((a,b)=>weight(b)-weight(a)).slice(0,4).map(e=>e.explanation),warnings};
}
