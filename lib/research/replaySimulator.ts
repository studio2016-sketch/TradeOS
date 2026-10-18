import type {Bar} from "../market/features";
export interface PaperReplayParams{decisionAt:string;symbol:string;startingEquity:number;riskBudget:number;stopPct:number;targetPct:number;slippageBps:number;commissionPerShare:number;maxBars:number}
export interface PaperReplayResult{
 mode:"HISTORICAL_PAPER_ONLY";status:"EXECUTED"|"NO_ENTRY_BAR"|"INVALID_INPUT";
 symbol:string;decisionAt:string;
 size:number;entryAt:string|null;exitAt:string|null;entryPrice:number|null;exitPrice:number|null;
 exitReason:"STOP"|"TARGET"|"HORIZON"|"NO_DATA"|null;
 grossPnl:number|null;netPnl:number|null;fees:number|null;
 maxAdversePct:number|null;maxFavorablePct:number|null;
 warnings:string[];
}
const validBar=(b:Bar)=>Number.isFinite(Date.parse(b.t))&&[b.o,b.h,b.l,b.c].every(n=>Number.isFinite(n)&&n>0)&&b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c,b.h);
export function simulateLongAfterDecision(bars:Bar[],p:PaperReplayParams):PaperReplayResult{
 const warning=["Paper-only historical bar simulation, not an actual execution record.","Requires independent verification of as-of signals, contemporaneous news, filings, corporate actions, order book, borrow constraints, costs and liquidity.","When stop and target are touched in one bar, the stop is assumed first. A stop gap is filled at the worse opening price."];
 const blank=(status:PaperReplayResult["status"]):PaperReplayResult=>({mode:"HISTORICAL_PAPER_ONLY",status,symbol:p.symbol,decisionAt:p.decisionAt,size:0,entryAt:null,exitAt:null,entryPrice:null,exitPrice:null,exitReason:status==="NO_ENTRY_BAR"?"NO_DATA":null,grossPnl:null,netPnl:null,fees:null,maxAdversePct:null,maxFavorablePct:null,warnings:warning});
 const decision=Date.parse(p.decisionAt);
 if(!Number.isFinite(decision)||!Number.isFinite(p.startingEquity)||p.startingEquity<=0||!Number.isFinite(p.riskBudget)||p.riskBudget<=0||p.riskBudget>p.startingEquity||!Number.isFinite(p.stopPct)||p.stopPct<=0||p.stopPct>=50||!Number.isFinite(p.targetPct)||p.targetPct<=0||p.targetPct>100||!Number.isFinite(p.slippageBps)||p.slippageBps<0||p.slippageBps>1000||!Number.isFinite(p.commissionPerShare)||p.commissionPerShare<0||p.commissionPerShare>100||p.maxBars<1||p.maxBars>500)return blank("INVALID_INPUT");
 // Signals must have been frozen at decisionAt. Data after it is used ONLY for evaluation.
 const future=bars.filter(validBar).filter(x=>Date.parse(x.t)>=decision).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t)).slice(0,p.maxBars);
 if(!future.length)return blank("NO_ENTRY_BAR");
 const entryBar=future[0],fill=entryBar.o*(1+p.slippageBps/10000);
 const intendedStop=fill*(1-p.stopPct/100),intendedTarget=fill*(1+p.targetPct/100);
 const perShareRisk=fill-intendedStop+2*p.commissionPerShare+fill*p.slippageBps/10000;
 const qty=Math.max(0,Math.min(Math.floor(p.startingEquity/fill),Math.floor(p.riskBudget/perShareRisk)));
 if(!qty)return blank("INVALID_INPUT");
 let exit=entryBar.c,reason:PaperReplayResult["exitReason"]="HORIZON",exitBar=entryBar;
 let mae=0,mfe=0;
 for(const bar of future){
  mae=Math.min(mae,(bar.l-fill)/fill*100);mfe=Math.max(mfe,(bar.h-fill)/fill*100);
  // Do not use entry-bar high/low to decide an exit after filling at the open
  // unless the conservative stop was reached.
  if(bar.l<=intendedStop){exit=Math.min(intendedStop,bar.o);reason="STOP";exitBar=bar;break}
  if(bar.h>=intendedTarget){exit=intendedTarget;reason="TARGET";exitBar=bar;break}
  exit=bar.c;exitBar=bar;
 }
 const exitFill=Math.max(.01,exit*(1-p.slippageBps/10000)),fees=qty*p.commissionPerShare*2,gross=(exitFill-fill)*qty;
 return{mode:"HISTORICAL_PAPER_ONLY",status:"EXECUTED",symbol:p.symbol,decisionAt:p.decisionAt,size:qty,entryAt:entryBar.t,exitAt:exitBar.t,entryPrice:+fill.toFixed(4),exitPrice:+exitFill.toFixed(4),exitReason:reason,grossPnl:+gross.toFixed(2),netPnl:+(gross-fees).toFixed(2),fees:+fees.toFixed(2),maxAdversePct:+mae.toFixed(3),maxFavorablePct:+mfe.toFixed(3),warnings:warning};
}
