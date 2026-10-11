export type PortfolioLimits={maxPositionPct:number;maxGrossPct:number;maxDailyLoss:number;maxSectorPct:number};
export type PaperPosition={symbol:string;sector:string;marketValue:number};
export type PortfolioRiskInput={equity:number;cash:number;dailyRealizedPnl:number;positions:PaperPosition[];candidate:{symbol:string;sector:string;notional:number;plannedRisk:number};limits:PortfolioLimits};
export type RiskGate={allowed:boolean;blockers:string[];metrics:{candidatePct:number;grossPct:number;sectorPct:number;remainingDailyRisk:number}};
/** Long-only research risk gate; no orders are sent. */
export function evaluatePaperRisk(x:PortfolioRiskInput):RiskGate{
 const blockers:string[]=[];
 const zero={candidatePct:0,grossPct:0,sectorPct:0,remainingDailyRisk:0};
 const {equity,cash,dailyRealizedPnl,positions,candidate,limits}=x;
 const finite=(v:number)=>Number.isFinite(v);
 if(![equity,cash,dailyRealizedPnl,candidate.notional,candidate.plannedRisk,limits.maxPositionPct,limits.maxGrossPct,limits.maxDailyLoss,limits.maxSectorPct].every(finite)||equity<=0||cash<0||candidate.notional<=0||candidate.plannedRisk<=0||positions.some(p=>!finite(p.marketValue)||p.marketValue<0)){return {allowed:false,blockers:["Invalid portfolio input"],metrics:zero};}
 if(!Object.values(limits).every(v=>v>0)||limits.maxPositionPct>100||limits.maxGrossPct>200||limits.maxSectorPct>100){return {allowed:false,blockers:["Invalid risk limits"],metrics:zero};}
 const gross=positions.reduce((sum,p)=>sum+p.marketValue,0);
 const same=positions.filter(p=>p.sector===candidate.sector).reduce((sum,p)=>sum+p.marketValue,0);
 const existing=positions.filter(p=>p.symbol===candidate.symbol).reduce((sum,p)=>sum+p.marketValue,0);
 const candidatePct=(existing+candidate.notional)/equity*100;
 const grossPct=(gross+candidate.notional)/equity*100;
 const sectorPct=(same+candidate.notional)/equity*100;
 const remainingDailyRisk=Math.max(0,limits.maxDailyLoss+Math.min(dailyRealizedPnl,0));
 if(candidate.notional>cash)blockers.push("Insufficient simulated available cash");
 if(candidatePct>limits.maxPositionPct)blockers.push("Per-symbol position cap exceeded");
 if(grossPct>limits.maxGrossPct)blockers.push("Gross exposure cap exceeded");
 if(sectorPct>limits.maxSectorPct)blockers.push("Sector exposure cap exceeded");
 if(candidate.plannedRisk>remainingDailyRisk)blockers.push("Daily risk budget exceeded");
 if(dailyRealizedPnl<=-limits.maxDailyLoss)blockers.push("Daily maximum loss already reached");
 return {allowed:!blockers.length,blockers,metrics:{candidatePct,grossPct,sectorPct,remainingDailyRisk}};
}
