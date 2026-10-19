export type AgentOrigin="external"|"internal";
export type AgentState="catalogued"|"awaiting_source"|"research_only";
export type AgentProfile={id:string;name:string;origin:AgentOrigin;purpose:string;state:AgentState;permissions:string[]};
export const externalAgents:AgentProfile[]=[
 {id:"moltbook",name:"Moltbook Discovery",origin:"external",purpose:"Read-only discovery of community hypotheses after approved API access and source verification.",state:"awaiting_source",permissions:["public_read_only"]},
 {id:"open-research",name:"Open Research Literature",origin:"external",purpose:"Identify published, citable studies and reproducible trading hypotheses.",state:"catalogued",permissions:["public_read_only"]},
 {id:"agent-tools",name:"Open Agent Tools",origin:"external",purpose:"Evaluate public agent frameworks and techniques in an isolated environment.",state:"catalogued",permissions:["public_read_only"]},
 {id:"macro-public",name:"Public Macro Research",origin:"external",purpose:"Investigate dated official economic data and changes in public indicators.",state:"catalogued",permissions:["public_read_only"]},
 {id:"public-agent-discussion",name:"Agent Community Watch",origin:"external",purpose:"Research public agent discussions without treating their claims as evidence.",state:"awaiting_source",permissions:["public_read_only"]}
];
export const internalAgents:AgentProfile[]=[
 {id:"market-structure",name:"Market Structure Analyst",origin:"internal",purpose:"Investigate regime and trend structure using available timestamped observations.",state:"research_only",permissions:["read_research"]},
 {id:"issuer",name:"Issuer & Fundamentals Analyst",origin:"internal",purpose:"Examine issuer disclosures and corporate relationships as testable hypotheses.",state:"research_only",permissions:["read_research"]},
 {id:"catalyst",name:"Catalyst Investigator",origin:"internal",purpose:"Connect dated catalysts to observable reactions and uncertainty.",state:"research_only",permissions:["read_research"]},
 {id:"statistics",name:"Factor Discovery Scientist",origin:"internal",purpose:"Demand chronological out-of-sample replication and transaction-cost realism.",state:"research_only",permissions:["read_research"]},
 {id:"adversary",name:"Adversarial Reviewer",origin:"internal",purpose:"Find contradictory evidence, leakage, confounding and missing data.",state:"research_only",permissions:["read_research"]},
 {id:"risk",name:"Capital Protection Analyst",origin:"internal",purpose:"Review protective gates and portfolio risk without order permissions.",state:"research_only",permissions:["read_research"]}
];
export const agentNetworkPolicy={
 weighting:{externalDiscovery:50,internalResearch:50},
 execution:"disabled",externalTrust:"untrusted_unless_independently_validated",
 autonomousPosting:false,externalAccountsConnected:false,
 promotion:"Human-governed Research Certification Authority only",
 controls:["no order placement","no brokerage credentials","no arbitrary remote code","no automatic model promotion","source URLs and observation times required"]
} as const;
export function researchDocket(input:{readings?:Array<{label?:string;state?:string;source?:string;note?:string;group?:string}>;symbol?:string;generatedAt?:string}){
 const readings=Array.isArray(input.readings)?input.readings:[];
 const missing=readings.filter(x=>x.state==="unavailable").slice(0,6);
 const contradictory=readings.filter(x=>x.state==="misaligned").slice(0,6);
 const observed=readings.filter(x=>x.state==="aligned").slice(0,4);
 return {symbol:input.symbol??null,generatedAt:input.generatedAt??null,mode:"deterministic_provisional_docket",
 investigations:[
  {agent:"market-structure",status:readings.length?"observed":"awaiting_evidence",evidence:observed.map(x=>({factor:x.label,source:x.source})),claim:"Observed aligned factors; no claim of predictive edge."},
  {agent:"adversary",status:readings.length?"observed":"awaiting_evidence",evidence:contradictory.map(x=>({factor:x.label,source:x.source})),claim:"Observed contrary conditions require independent examination."},
  {agent:"statistics",status:"pending_validation",evidence:[],claim:"No predictive edge is asserted without independent chronological and prospective tests."},
  {agent:"risk",status:readings.length?"observed":"awaiting_evidence",evidence:missing.map(x=>({factor:x.label,source:x.source})),claim:"Unavailable evidence is never treated as a passing risk condition."}
 ],certifiedFindings:0,externalFindingsPromoted:0};
}
