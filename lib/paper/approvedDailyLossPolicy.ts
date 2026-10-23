/** Approved 2026-10-23: paper-only daily realized-loss ceiling.
 * Policy value is 1% of beginning-of-trading-day account equity.
 * This is a loss ceiling, not a permission to trade or a broker-enforced stop.
 * Live environment remains unapproved and MUST fail closed.
 */
export const PAPER_DAILY_LOSS_POLICY={
 id:"paper-daily-loss-2026-10-23-v1",
 environment:"paper" as const,
 effectiveDate:"2026-10-23",
 maxDailyLossFraction:0.01,
 approved:true,
 liveTradingApproved:false,
} as const;

export function approvedPaperDailyLossLimit(input:{
 environment:"paper"|"live";
 beginningOfDayEquity:number;
 equityAsOf:string;
 sessionDate:string;
}):number|null{
 if(input.environment!=="paper"||!PAPER_DAILY_LOSS_POLICY.approved||
    input.sessionDate<PAPER_DAILY_LOSS_POLICY.effectiveDate||
    !Number.isFinite(input.beginningOfDayEquity)||input.beginningOfDayEquity<=0||
    !Number.isFinite(Date.parse(input.equityAsOf))||
    input.equityAsOf.slice(0,10)!==input.sessionDate)return null;
 return input.beginningOfDayEquity*PAPER_DAILY_LOSS_POLICY.maxDailyLossFraction;
}
/** No estimate, simulated P&L or current account equity is accepted as a substitute
 * for independently reconciled realized trading-day P&L.
 */
export function remainingApprovedDailyRisk(limit:number|null,realizedPnl:number|null,verified:boolean):number|null{
 if(!verified||limit===null||realizedPnl===null||!Number.isFinite(realizedPnl))return null;
 return Math.max(0,limit+Math.min(0,realizedPnl));
}
