import {simulatePaperBuy,type PaperOrder,type PaperQuote} from "./simulator";
import {evaluatePaperRisk,type PortfolioRiskInput} from "./portfolioRisk";
export type IntegratedDecision={status:"blocked"|"unfilled"|"simulated_fill";risk:ReturnType<typeof evaluatePaperRisk>;execution:ReturnType<typeof simulatePaperBuy>|null;disclaimer:string};
export function evaluatePaperCandidate(order:PaperOrder,quote:PaperQuote|null,portfolio:PortfolioRiskInput,nowMs=Date.now()):IntegratedDecision{
 const risk=evaluatePaperRisk(portfolio);
 const base="Research-only paper simulation, no broker call, no real orders, no guarantee of fill or stop execution.";
 if(!risk.allowed)return{status:"blocked",risk,execution:null,disclaimer:base};
 if(portfolio.candidate.symbol!==order.symbol||Math.abs(portfolio.candidate.notional-order.limitPrice*order.quantity)>0.011||Math.abs(portfolio.candidate.plannedRisk-(order.limitPrice-order.stopPrice)*order.quantity)>0.011)return{status:"blocked",risk:{...risk,allowed:false,blockers:[...risk.blockers,"Risk assessment does not match order"]},execution:null,disclaimer:base};
 const execution=simulatePaperBuy(order,quote,nowMs);
 return{status:execution.status==="filled"?"simulated_fill":execution.status==="unfilled"?"unfilled":"blocked",risk,execution,disclaimer:base};
}
