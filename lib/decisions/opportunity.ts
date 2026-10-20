export type DecisionInput={symbol:string;asOf:string;dataFresh:boolean;tradable:boolean;spreadBps:number;regime:number;trend:number;relativeStrength:number;riskReward:number;liquidity:number;council:number;evidence:number};
export type DecisionOutput={symbol:string;decision:"RESEARCH_CANDIDATE"|"WATCH"|"NO_TRADE";score:number|null;gates:string[];weights:Record<string,number>;certified:false;executionEnabled:false;explanation:string};
const weights={evidence:.25,regime:.20,trend:.075,relativeStrength:.075,riskReward:.20,liquidity:.10,council:.10} as const;
export function assessOpportunity(input:DecisionInput):DecisionOutput{
 const gates:string[]=[];
 if(!/^[A-Z0-9.^-]{1,20}$/.test(input.symbol))gates.push("Invalid security identifier");
 if(!Number.isFinite(Date.parse(input.asOf)))gates.push("Missing as-of timestamp");
 if(!input.dataFresh)gates.push("Market data freshness unverified");
 if(!input.tradable)gates.push("Tradability not established");
 if(!Number.isFinite(input.spreadBps)||input.spreadBps<0||input.spreadBps>50)gates.push("Spread exceeds initial safety screen or is unavailable");
 for(const k of Object.keys(weights) as Array<keyof typeof weights>)if(!Number.isFinite(input[k])||input[k]<0||input[k]>100)gates.push("Invalid "+k+" assessment");
 const score=gates.length?null:Math.round((Object.keys(weights) as Array<keyof typeof weights>).reduce((s,k)=>s+input[k]*weights[k],0)*10)/10;
 const decision:gatedDecision=score===null?"NO_TRADE":score>=80?"RESEARCH_CANDIDATE":score>=60?"WATCH":"NO_TRADE";
 return {symbol:input.symbol,decision,score,gates,weights:{...weights},certified:false,executionEnabled:false,explanation:score===null?"Mandatory data and execution-quality gates failed.":decision==="RESEARCH_CANDIDATE"?"Research-only candidate. Weights and scores are exploratory, not validated probabilities.":decision==="WATCH"?"Observation candidate; wait for independent evidence.":"Insufficient evidence for further evaluation."};
}
type gatedDecision=DecisionOutput["decision"];
