import {FACTOR_CATALOG,FACTOR_KEYS} from "./acceleration-factors";
import type {SourceTimeCertificate} from "./source-time-certification";

export type FactorEvidenceAudit={
 factorKey:string;observations:number;subjects:number;sources:string[];sourceTimeEligibleObservations:number;
 latestAvailableAt:string|null;chronologyOk:boolean;finiteOk:boolean;
};

type ImplementationEvidence={implementationPath:string;verificationSuite:string;method:string};

const marketEngine=[
 "sma_5","sma_20","sma_50","sma_200","return_1d","return_5d","intraday_range","dollar_volume","gap_pct","price_acceleration",
 "relative_volume","atr_14","realized_vol_5","realized_vol_20","volatility_regime","vol_of_vol","ema_9","ema_21","macd","macd_signal",
 "adx","breakout_strength","overnight_vol","gap_frequency","beta","rolling_correlation"
];
const snapshotEngine=["daily_volume","distance_vwap","bid_ask_spread","spread_bps","quoted_depth","order_imbalance"];
const intradayEngine=["return_1m","return_5m","return_15m","return_1h","trade_count","turnover","slippage_estimate"];
const officialMacro=[
 "us10y_yield","us2y_yield","yield_curve_slope","fed_policy_rate","high_yield_spread","wti_crude","dxy","real_yield",
 "investment_grade_spread","repo_rate","credit_conditions","cpi_yoy","core_cpi","pce_yoy","gdp_growth","retail_sales",
 "jobless_claims","unemployment","nonfarm_payrolls","consumer_confidence","capacity_utilization","natural_gas","eurusd","usdjpy",
 "bitcoin","copper","gold","pmi_manufacturing","input_cost_shock","treasury_issuance"
];
const portfolioEngine=["portfolio_exposure","single_name_weight","position_volatility","var_95","expected_shortfall","max_drawdown"];

function implementationEntries(keys:string[],value:ImplementationEvidence){return keys.map(key=>[key,value] as const)}
export const FACTOR_IMPLEMENTATION_VERIFICATION=new Map<string,ImplementationEvidence>([
 ...implementationEntries(marketEngine,{implementationPath:"lib/research/market-factor-engine.ts",verificationSuite:"tests/market-factor-engine.test.mjs + tests/independent-market-factors.test.mjs",method:"Deterministic reference vectors, history-depth failure cases, chronology sorting, and synchronized benchmark checks"}),
 ...implementationEntries(snapshotEngine,{implementationPath:"lib/research/snapshot-factor-engine.ts",verificationSuite:"tests/snapshot-factor-engine.test.ts",method:"Independent arithmetic vectors plus stale and future-quote rejection"}),
 ...implementationEntries(intradayEngine,{implementationPath:"lib/research/intraday-activation-evidence.ts",verificationSuite:"tests/intraday-factor-engine.test.ts",method:"Independent point-in-time return, count, turnover, and quoted half-spread vectors"}),
 ...implementationEntries(officialMacro,{implementationPath:"lib/research/official-macro-evidence.ts",verificationSuite:"tests/official-macro-evidence.test.ts + tests/dxy-reconstruction.test.mjs + tests/input-cost-evidence.test.mjs + tests/treasury-issuance-evidence.test.mjs",method:"Pinned series map, independent formula vectors, missing-history failure cases, and source-date preservation"})
 ,...implementationEntries(portfolioEngine,{implementationPath:"lib/research/portfolio-factor-engine.ts",verificationSuite:"tests/portfolio-factor-engine.test.ts",method:"Synchronized-return, current-weight reference vectors with insufficient-history failure cases"})
]);

const officialSource=/^(FRED(?::|\s)|SEC EDGAR|U\.S\. Treasury Fiscal Data)/i;
const authenticatedMarketSource=/^(Alpaca:(iex|delayed_sip)(:|\b))/i;
function sourceIdentityRecognized(source:string){
 return officialSource.test(source)||authenticatedMarketSource.test(source);
}
function isPureIexSource(source:string){return /^Alpaca:iex(?::(?:1Day|1Min))?$/i.test(source.trim())}

export function auditFactorVerification(evidence:FactorEvidenceAudit[],certificates:SourceTimeCertificate[],asOf:string){
 const clock=Date.parse(asOf);if(!Number.isFinite(clock))throw Error("Invalid factor-verification time");
 const byFactor=new Map(evidence.map(row=>[row.factorKey,row]));
 const familyByKey=new Map(FACTOR_CATALOG.map(x=>[x.key,x.family]));
 const factors=FACTOR_KEYS.map(key=>{
  const row=byFactor.get(key),implementation=FACTOR_IMPLEMENTATION_VERIFICATION.get(key);
  const observations=Number(row?.observations??0),subjects=Number(row?.subjects??0),sources=row?.sources??[];
  const measured=observations>0;
  const chronological=measured&&row?.chronologyOk===true;
  const finite=measured&&row?.finiteOk===true;
  const implementationVerified=Boolean(implementation);
  const sourceIdentityVerified=sources.length>0&&sources.every(sourceIdentityRecognized);
  const latest=row?.latestAvailableAt??null;
  const sourceTimeCertified=observations>0&&row?.sourceTimeEligibleObservations===observations;
  const measurementDepth=observations>=5;
  const engineeringVerified=implementationVerified&&measured&&chronological&&finite&&measurementDepth;
  // Predictive validity is deliberately not inferred from implementation or measurement evidence.
  const independentReplayVerified=false,prospectiveValidationPassed=false,multiplicityControlled=false;
  const fullyVerified=engineeringVerified&&sourceIdentityVerified&&sourceTimeCertified&&measurementDepth&&independentReplayVerified&&prospectiveValidationPassed&&multiplicityControlled;
  const blockers:string[]=[];
  if(!implementationVerified)blockers.push("IMPLEMENTATION_NOT_IN_VERIFIED_MANIFEST");
  if(!measured)blockers.push("NO_MEASURED_EVIDENCE");
  if(measured&&!chronological)blockers.push("EVIDENCE_CHRONOLOGY_FAILED");
  if(measured&&!finite)blockers.push("NONFINITE_EVIDENCE");
  if(!sourceIdentityVerified)blockers.push("SOURCE_IDENTITY_NOT_PRIMARY_OR_ENTITLED");
  if(!sourceTimeCertified)blockers.push("INDEPENDENT_SOURCE_TIME_NOT_CERTIFIED_FOR_EVERY_OBSERVATION");
  if(!measurementDepth)blockers.push("MEASUREMENT_DEPTH_BELOW_FIVE");
  if(!independentReplayVerified)blockers.push("INDEPENDENT_REPLAY_PENDING");
  if(!prospectiveValidationPassed)blockers.push("PROSPECTIVE_VALIDATION_PENDING");
  if(!multiplicityControlled)blockers.push("MULTIPLE_TESTING_CONTROL_PENDING");
  return{
   key,family:familyByKey.get(key)??"unknown",observations,subjects,sources,latestAvailableAt:latest,
   gates:{implementationVerified,measured,chronological,finite,sourceIdentityVerified,sourceTimeCertified,measurementDepth,independentReplayVerified,prospectiveValidationPassed,multiplicityControlled},
   status:fullyVerified?"FULLY_VERIFIED":sourceTimeCertified&&engineeringVerified?"SOURCE_TIME_VERIFIED":engineeringVerified?"ENGINEERING_VERIFIED":measured?"MEASURED_UNVERIFIED":"UNMEASURED",
   implementation:implementation??null,blockers,modelInfluenceAllowed:fullyVerified
  };
 });
 const count=(status:string)=>factors.filter(f=>f.status===status).length;
 return{
  generatedAt:new Date(clock).toISOString(),defined:FACTOR_KEYS.length,
  counts:{unmeasured:count("UNMEASURED"),measuredUnverified:count("MEASURED_UNVERIFIED"),engineeringVerified:count("ENGINEERING_VERIFIED"),sourceTimeVerified:count("SOURCE_TIME_VERIFIED"),fullyVerified:count("FULLY_VERIFIED")},
  gates:{implementationVerified:factors.filter(f=>f.gates.implementationVerified).length,measured:factors.filter(f=>f.gates.measured).length,sourceIdentityVerified:factors.filter(f=>f.gates.sourceIdentityVerified).length,sourceTimeCertified:factors.filter(f=>f.gates.sourceTimeCertified).length,modelInfluenceAllowed:factors.filter(f=>f.modelInfluenceAllowed).length},
  factors,
  policy:"Engineering verification proves a tested calculation produced finite chronological evidence. It does not establish prediction. Full verification additionally requires independently certified source timing, independent replay, prospective validation, and multiple-testing control.",
  approvedForTrading:false
 };
}
