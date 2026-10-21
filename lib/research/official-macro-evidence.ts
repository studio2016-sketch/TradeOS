import {fredSeriesHistory,latestRegimeContext,type FredHistoryResult} from "../market/fred";
import {auditEvidence,type Evidence} from "./source-vintage-audit";
const mapping:Record<string,string>={DGS10:"us10y_yield",DGS2:"us2y_yield",T10Y2Y:"yield_curve_slope",DFF:"fed_policy_rate",BAMLH0A0HYM2:"high_yield_spread",DCOILWTICO:"wti_crude"};

type Derivation="latest"|"year_over_year_pct";
type MacroDefinition={factor:string;series:string;label:string;unit:string;derivation:Derivation;lookbackDays:number};

/** Ten additional catalog factors backed by public, current-vintage FRED observations. */
export const addedOfficialMacroFactors:MacroDefinition[]=[
 {factor:"real_yield",series:"DFII10",label:"10-Year Treasury Inflation-Indexed Security",unit:"percent",derivation:"latest",lookbackDays:90},
 {factor:"investment_grade_spread",series:"BAMLC0A0CM",label:"US Corporate Option-Adjusted Spread",unit:"percent",derivation:"latest",lookbackDays:90},
 {factor:"repo_rate",series:"SOFR",label:"Secured Overnight Financing Rate",unit:"percent",derivation:"latest",lookbackDays:90},
 {factor:"credit_conditions",series:"NFCI",label:"Chicago Fed National Financial Conditions Index",unit:"index",derivation:"latest",lookbackDays:90},
 {factor:"cpi_yoy",series:"CPIAUCSL",label:"Consumer Price Index",unit:"percent year over year",derivation:"year_over_year_pct",lookbackDays:500},
 {factor:"core_cpi",series:"CPILFESL",label:"Core Consumer Price Index",unit:"percent year over year",derivation:"year_over_year_pct",lookbackDays:500},
 {factor:"pce_yoy",series:"PCEPI",label:"Personal Consumption Expenditures Price Index",unit:"percent year over year",derivation:"year_over_year_pct",lookbackDays:500},
 {factor:"gdp_growth",series:"A191RL1Q225SBEA",label:"Real GDP Growth",unit:"annualized percent",derivation:"latest",lookbackDays:500},
 {factor:"retail_sales",series:"RSAFS",label:"Advance Retail Sales",unit:"percent year over year",derivation:"year_over_year_pct",lookbackDays:500},
 {factor:"jobless_claims",series:"ICSA",label:"Initial Unemployment Claims",unit:"claims",derivation:"latest",lookbackDays:90}
];

export function deriveOfficialMacroFactor(definition:MacroDefinition,result:FredHistoryResult){
 if(result.status!=="ok"||!result.points.length)return {value:null,observedAt:null,reason:result.error??result.status};
 const latest=result.points[result.points.length-1];
 if(definition.derivation==="latest")return Number.isFinite(latest.value)?{value:latest.value,observedAt:latest.date,reason:null}:{value:null,observedAt:null,reason:"invalid_latest_value"};
 const latestMonth=latest.date.slice(5,7),priorYear=String(Number(latest.date.slice(0,4))-1);
 const prior=[...result.points].reverse().find(point=>point.date.startsWith(`${priorYear}-${latestMonth}`));
 if(!prior||!Number.isFinite(prior.value)||prior.value===0)return {value:null,observedAt:null,reason:"missing_prior_year_observation"};
 const value=(latest.value/prior.value-1)*100;
 return Number.isFinite(value)?{value,observedAt:latest.date,reason:null}:{value:null,observedAt:null,reason:"invalid_yoy_result"};
}

async function expandedMacroResults(){
 const results=new Map<string,FredHistoryResult>();
 // Small batches avoid a burst against the public endpoint while staying within the route budget.
 for(let i=0;i<addedOfficialMacroFactors.length;i+=3){
  const batch=addedOfficialMacroFactors.slice(i,i+3);
  const rows=await Promise.all(batch.map(def=>fredSeriesHistory(def.series,def.lookbackDays)));
  rows.forEach(row=>results.set(row.series,row));
 }
 return results;
}

export async function observedMacroEvidence(now=new Date()){
 const requestedAt=now.toISOString();
 const [context,expanded]=await Promise.all([latestRegimeContext(),expandedMacroResults()]);
 const receivedAt=new Date().toISOString();
 const evidence:Evidence[]=[];
 const excluded:string[]=[];
 for(const diagnostic of context.diagnostics){
  const factor=mapping[diagnostic.series];
  const point=diagnostic.point;
  if(!factor||diagnostic.status!=="ok"||!point||!Number.isFinite(point.value)){excluded.push(diagnostic.series);continue;}
  const observedAt=point.date+"T00:00:00Z";
  if(!Number.isFinite(Date.parse(observedAt))||Date.parse(observedAt)>Date.parse(requestedAt)){excluded.push(diagnostic.series);continue;}
  // FRED observation dates are NOT original public release timestamps.
  // Only claim availability at actual retrieval, never retroactively.
  evidence.push({factor,value:point.value as number,domain:"macro",source:"FRED:"+diagnostic.series,subject:"US_MACRO",observedAt,availableAt:receivedAt});
 }
 const addedFactors:{factor:string;series:string;label:string;unit:string;value:number|null;observedAt:string|null;status:"measured"|"unavailable";reason:string|null}[]=[];
 for(const definition of addedOfficialMacroFactors){
  const result=expanded.get(definition.series)??{series:definition.series,points:[],status:"empty" as const};
  const derived=deriveOfficialMacroFactor(definition,result);
  addedFactors.push({...definition,value:derived.value,observedAt:derived.observedAt,status:derived.value===null?"unavailable":"measured",reason:derived.reason});
  if(derived.value===null||!derived.observedAt){excluded.push(definition.series);continue;}
  evidence.push({factor:definition.factor,value:derived.value,domain:"macro",source:"FRED:"+definition.series,subject:"US_MACRO",observedAt:derived.observedAt+"T00:00:00Z",availableAt:receivedAt});
 }
 const audit=auditEvidence(evidence,receivedAt);
 return {retrievedAt:receivedAt,requestedAt,measured:audit.measured,addedMeasured:addedFactors.filter(x=>x.status==="measured").length,addedTarget:addedOfficialMacroFactors.length,addedFactors,factors:evidence,excluded,audit,backtestEligible:false,approvedForTrading:false,warning:"FRED current-vintage observations: retrieval proves present availability, not historical release availability, predictive usefulness, or independent data vintage."};
}
