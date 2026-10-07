import {curatedNews} from "./news";
import type {MarketSnapshot} from "./types";

export type GlobalRiskLevel="BACKGROUND"|"RELEVANT"|"MACRO"|"SEVERE"|"SYSTEMIC";
export interface GlobalRiskEvent{
  id:string;timestamp:string;headline:string;source:string;symbols:string[];
  category:string;credibility:number;severity:number;relevance:number;recency:number;
  transmission:number;score:number;level:GlobalRiskLevel;reasons:string[];
}
export interface GlobalRiskResult{
  generatedAt:string;score:number;level:GlobalRiskLevel;buyMultiplier:number;sellAdditive:number;
  buyClamp:boolean;capitalGuardOverride:boolean;verifiedTransmission:boolean;
  events:GlobalRiskEvent[];reasons:string[];
}

const patterns:Array<[string,RegExp,number]>=[
  ["War / military escalation",/\\b(war|missile|airstrike|invasion|military strike|mobilization|ceasefire collapse|attack on)\\b/i,.95],
  ["Sanctions / trade restrictions",/\\b(sanction|export ban|export control|embargo|trade restriction)\\b/i,.78],
  ["Tariff / trade policy",/\\b(tariff|trade war|import duty|retaliatory tariff)\\b/i,.72],
  ["Central-bank shock",/\\b(emergency rate|surprise rate|intervention|unscheduled meeting|capital controls?)\\b/i,.92],
  ["Sovereign / credit event",/\\b(default|debt restructuring|sovereign crisis|credit event|bank run)\\b/i,.95],
  ["Financial-system stress",/\\b(bank failure|liquidity crisis|systemic risk|clearing failure|exchange halt)\\b/i,.98],
  ["Cyber / infrastructure",/\\b(cyberattack|ransomware|grid outage|payment outage|exchange outage|infrastructure attack)\\b/i,.86],
  ["Energy disruption",/\\b(oil disruption|pipeline attack|shipping disruption|strait closure|energy supply shock)\\b/i,.84],
  ["Election / political shock",/\\b(election upset|snap election|martial law|coup|government collapse|constitutional crisis)\\b/i,.84],
  ["Natural disaster",/\\b(earthquake|tsunami|hurricane|wildfire|flood|natural disaster)\\b/i,.62]
];

function clamp(n:number,min=0,max=1){return Math.max(min,Math.min(max,n))}
function level(score:number,verified:boolean):GlobalRiskLevel{
  if(score>=.90&&verified)return"SYSTEMIC";
  if(score>=.75&&verified)return"SEVERE";
  if(score>=.55)return"MACRO";
  if(score>=.30)return"RELEVANT";
  return"BACKGROUND";
}

function marketTransmission(snapshots:MarketSnapshot[],headline:string,symbols:string[]){
  if(!snapshots.length)return{score:0,reasons:["No live market snapshots available for transmission confirmation"]};
  const reasons:string[]=[];
  let score=0;
  const broad=snapshots.filter(s=>["SPY","QQQ","IWM"].includes(s.symbol));
  const spreads=snapshots.map(s=>s.bid&&s.ask&&s.price?(s.ask-s.bid)/s.price:null).filter((x):x is number=>x!=null);
  if(spreads.some(x=>x>.003)){score+=.22;reasons.push("Liquidity/spread deterioration detected");}
  const affected=snapshots.filter(s=>symbols.includes(s.symbol));
  if(affected.length){score+=.12;reasons.push("Affected symbols are present in the live observation set");}
  if(broad.length>=2){score+=.12;reasons.push("Broad-market transmission can be observed");}
  if(/oil|energy|shipping|strait/i.test(headline)){score+=.08;reasons.push("Event maps to an economically sensitive transmission channel");}
  return{score:clamp(score),reasons};
}

export async function globalEventRisk(marketSnapshots:MarketSnapshot[]=[],watchlist:string[]=[]):Promise<GlobalRiskResult>{
  const {news,errors}=await curatedNews([],80);
  const now=Date.now();
  const events:GlobalRiskEvent[]=[];
  for(const n of news){
    const text=(n.headline+" "+n.summary).trim();
    const matches=patterns.filter(([,re])=>re.test(text));
    if(!matches.length)continue;
    const strongest=matches.sort((a,b)=>b[2]-a[2])[0];
    const age=Math.max(0,now-new Date(n.timestamp).getTime());
    const recency=clamp(1-age/(24*60*60*1000));
    const overlap=n.symbols.filter(s=>watchlist.includes(s)).length;
    const relevance=clamp(.45+(overlap?Math.min(.4,overlap*.12):0));
    const credibility=clamp(n.sourceQuality||.6);
    const severity=strongest[2];
    const trans=marketTransmission(marketSnapshots,text,n.symbols);
    const transmission=trans.score;
    const base=.30*severity+.25*credibility+.20*recency+.10*relevance+.15*transmission;
    const score=clamp(base);
    const verified=transmission>=.20;
    events.push({
      id:n.id,timestamp:n.timestamp,headline:n.headline,source:n.source,symbols:n.symbols,
      category:strongest[0],credibility,severity,relevance,recency,transmission,score,
      level:level(score,verified),
      reasons:["Category: "+strongest[0],"Source quality: "+Math.round(credibility*100)+"%","Recency: "+Math.round(recency*100)+"%",...trans.reasons]
    });
  }
  events.sort((a,b)=>b.score-a.score);
  const top=events[0];
  const score=top?.score??0;
  const verifiedTransmission=Boolean(top&&top.transmission>=.20);
  const riskLevel=level(score,verifiedTransmission);
  const buyClamp=riskLevel==="SEVERE"||riskLevel==="SYSTEMIC";
  const capitalGuardOverride=riskLevel==="SYSTEMIC";
  const buyMultiplier=riskLevel==="BACKGROUND"?1:riskLevel==="RELEVANT"?.97:riskLevel==="MACRO"?.90:riskLevel==="SEVERE"?.72:.45;
  const sellAdditive=riskLevel==="BACKGROUND"?0:riskLevel==="RELEVANT"?5:riskLevel==="MACRO"?12:riskLevel==="SEVERE"?25:45;
  return{
    generatedAt:new Date().toISOString(),score:+(score*100).toFixed(1),level:riskLevel,buyMultiplier,sellAdditive,buyClamp,capitalGuardOverride,verifiedTransmission,
    events:events.slice(0,20),
    reasons:[
      top?"Highest event: "+top.category:"No qualifying global event detected in connected provider news",
      verifiedTransmission?"Market transmission verified":"Market transmission not verified",
      ...(errors.length?["Provider errors: "+errors.join(" | ")]:[])
    ]
  };
}