export const factorCoveragePolicy={
 target:101,
 scope:"B: 120 factors across stocks, options, macroeconomics, news, and portfolio contexts; only count applicable, observed, timestamped values",
 approval:"User selected Option B on 2026-10-20",
 denominator:120,
 eligibleValue:"finite numeric observation with documented provider, observation time, and applicability",
 forbid:["fabricated values","forward-looking information","zero used for unknown","relabeling one input as independent evidence"],
 strategy:[
 "Measure price and technical indicators from timestamped bar history",
 "Measure macroeconomic factors from actual point-in-time releases",
 "Measure company fundamentals only where available and applicable",
 "Measure options variables only where an eligible option surface exists",
 "Measure portfolio risk only for a defined and timestamped portfolio",
 "Keep non-applicable factors explicitly unavailable"
 ],
 status:"Option B approved; 101 measured factors not yet achieved"
};
export function coverageGate(measured:number,applicable:number){
 if(!Number.isInteger(measured)||!Number.isInteger(applicable)||applicable<0||applicable>120||measured<0||measured>applicable)throw Error("Invalid coverage");
 return {measured,applicable,target:101,passed:measured>=101,allFactorPct:Math.round(1000*measured/120)/10,applicablePct:applicable?Math.round(1000*measured/applicable)/10:null,certified:false};
}
