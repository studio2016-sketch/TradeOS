/** Source-backed research leads. Attribution is limited to the cited source; no 17-of-20 consensus is asserted. */
export const expertEvidence=[
 {expert:"Howard Marks",principle:"RISK_CYCLES",stance:"supports",source:"https://www.oaktreecapital.com/insights/memo/the-best-of",published:"2025-10-12",summary:"Marks identifies risk control, cycles, and second-level thinking among his enduring investing principles.",sourceType:"primary"},
 {expert:"Warren Buffett",principle:"MARKET_PRICE_VS_VALUE",stance:"supports",source:"https://www.berkshirehathaway.com/letters/1987.html",published:"1988-02-29",summary:"Berkshire shareholder letter distinguishes quoted prices from underlying business results and describes Graham's Mr. Market framework.",sourceType:"primary"},
 {expert:"Cliff Asness",principle:"TREND_EVIDENCE",stance:"related_not_individual_attestation",source:"https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing",published:"2017-10-31",summary:"AQR research by Hurst, Ooi and Pedersen finds long historical evidence for trend following. This is research at Asness's firm, not his personal documented vote.",sourceType:"institutional_research"},
] as const;
export const researchLessons=[
 {name:"Respect regime disagreement",method:"Evaluate trend-following and mean-reversion as separate regime-specific challengers; do not average conflicting signals blindly.",test:"Net return and drawdown by predeclared market regime",constraint:"Regime labels must use only information available before decisions."},
 {name:"Respect value versus price",method:"Compare earnings/fundamental valuation to price-based trend but preserve their distinct horizons.",test:"Incremental net performance versus price-only and valuation-only baselines",constraint:"No hindsight revisions of earnings or fundamentals."},
 {name:"Make downside first-class",method:"Require explicit loss scenario, concentration review, exit invalidation and NO TRADE eligibility.",test:"Max drawdown, tail losses and foregone returns against a controlled baseline",constraint:"Do not claim ability to avert all losses."},
] as const;
/** Mechanical source-lead tally only, not an attribution/consensus review.
 * Opposing or mixed records veto support for that individual regardless of URL validity.
 * Unknowns do not vote; malformed stances veto rather than silently becoming support.
 * This legacy input has no reviewed passages or conflict adjudication, so it can never
 * establish verified consensus. A future reviewed-evidence contract must be separate.
 */
export function countDocumentedSupport(principle:string,cohort:readonly string[],votes:readonly {expert:string;principle:string;stance:string;source:string}[]){
 const unique=new Set(cohort);
 if(cohort.length!==20||unique.size!==20||cohort.some(name=>!name.trim()||name!==name.trim()))throw Error("Consensus cohort must contain exactly 20 distinct experts");
 if(!principle.trim())throw Error("A narrowly defined principle is required");
 const approved=new Set<string>(),opposed=new Set<string>(),mixed=new Set<string>(),unresolved=new Set<string>();
 for(const expert of cohort){
  const records=votes.filter(v=>v.principle===principle&&v.expert===expert);
  const supports=records.some(v=>v.stance==="supports");
  const contradicts=records.some(v=>v.stance==="contradicts");
  if(records.some(v=>v.stance==="mixed")||(supports&&contradicts)){mixed.add(expert);continue;}
  if(contradicts){opposed.add(expert);continue;}
  if(records.some(v=>!["supports","contradicts","mixed","unknown","related_not_individual_attestation"].includes(v.stance))){unresolved.add(expert);continue;}
  if(records.some(v=>v.stance==="supports"&&validSourceLead(v.source)))approved.add(expert);
 }
 return {supporters:approved.size,required:17,mechanicalThresholdMet:approved.size>=17,
  verified85Percent:false as const,notEstablished:true as const,status:"UNVERIFIED" as const,
  contradictingCount:opposed.size,mixedCount:mixed.size,unresolvedCount:unresolved.size,
  unknownCount:20-approved.size-opposed.size-mixed.size-unresolved.size,
  warning:"Source leads are not reviewed attestations. This tally cannot verify consensus; reviewed passages, individual attribution and contradiction adjudication are required. No certification or trading authority is granted."};
}
function validSourceLead(source:string){
 try{const url=new URL(source);return url.protocol==="https:"&&!!url.hostname&&!url.username&&!url.password;}catch{return false;}
}
