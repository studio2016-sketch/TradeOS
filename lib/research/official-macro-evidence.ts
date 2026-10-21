import {fredSeriesHistory,type FredHistoryResult} from "../market/fred";
import {auditEvidence,type Evidence} from "./source-vintage-audit";
const mapping:Record<string,string>={DGS10:"us10y_yield",DGS2:"us2y_yield",T10Y2Y:"yield_curve_slope",DFF:"fed_policy_rate",BAMLH0A0HYM2:"high_yield_spread",DCOILWTICO:"wti_crude"};
const baseSeries=Object.keys(mapping).map(series=>({series,lookbackDays:90}));
const dxySupplementalSeries=["DEXUSUK","DEXCAUS","DEXSDUS","DEXSZUS"].map(series=>({series,lookbackDays:90}));
const dxyComponents=["DEXUSEU","DEXJPUS","DEXUSUK","DEXCAUS","DEXSDUS","DEXSZUS"] as const;

export function reconstructDxy(r:{eurusd:number;usdjpy:number;gbpusd:number;usdcad:number;usdsek:number;usdchf:number}){
 const values=Object.values(r);
 if(values.some(v=>!Number.isFinite(v)||v<=0))return null;
 const value=50.14348112*Math.pow(r.eurusd,-0.576)*Math.pow(r.usdjpy,0.136)*Math.pow(r.gbpusd,-0.119)*Math.pow(r.usdcad,0.091)*Math.pow(r.usdsek,0.042)*Math.pow(r.usdchf,0.036);
 return Number.isFinite(value)&&value>0?value:null;
}

type Derivation="latest"|"year_over_year_pct";
type MacroDefinition={factor:string;series:string;label:string;unit:string;derivation:Derivation;lookbackDays:number};

/** Additional catalog factors backed by public, current-vintage FRED observations. */
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
 {factor:"jobless_claims",series:"ICSA",label:"Initial Unemployment Claims",unit:"claims",derivation:"latest",lookbackDays:90},
 {factor:"unemployment",series:"UNRATE",label:"US Unemployment Rate",unit:"percent",derivation:"latest",lookbackDays:180},
 {factor:"nonfarm_payrolls",series:"PAYEMS",label:"Total Nonfarm Payroll Employment",unit:"thousands of persons",derivation:"latest",lookbackDays:180},
 {factor:"consumer_confidence",series:"UMCSENT",label:"University of Michigan Consumer Sentiment",unit:"index",derivation:"latest",lookbackDays:180},
 {factor:"capacity_utilization",series:"TCU",label:"Total Industry Capacity Utilization",unit:"percent",derivation:"latest",lookbackDays:180},
 {factor:"natural_gas",series:"DHHNGSP",label:"Henry Hub Natural Gas Spot Price",unit:"USD per MMBtu",derivation:"latest",lookbackDays:90},
 {factor:"eurusd",series:"DEXUSEU",label:"US Dollars to Euro Exchange Rate",unit:"USD per EUR",derivation:"latest",lookbackDays:90},
 {factor:"usdjpy",series:"DEXJPUS",label:"Japanese Yen to US Dollar Exchange Rate",unit:"JPY per USD",derivation:"latest",lookbackDays:90},
 {factor:"bitcoin",series:"CBBTCUSD",label:"Coinbase Bitcoin",unit:"USD per BTC",derivation:"latest",lookbackDays:90},
 {factor:"copper",series:"PCOPPUSDM",label:"Global Price of Copper",unit:"USD per metric ton",derivation:"latest",lookbackDays:500},
 {factor:"pmi_manufacturing",series:"NAPM",label:"ISM Manufacturing PMI",unit:"index",derivation:"latest",lookbackDays:500}
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

async function macroResults(){
 const results=new Map<string,FredHistoryResult>();
 const definitions=[...new Map([...baseSeries,...addedOfficialMacroFactors.map(({series,lookbackDays})=>({series,lookbackDays})),...dxySupplementalSeries].map(x=>[x.series,x])).values()];
 // Bounded batches avoid a burst while eliminating the old sequential regime-context bottleneck.
 for(let i=0;i<definitions.length;i+=3){
  const batch=definitions.slice(i,i+3);
  const rows=await Promise.all(batch.map(def=>fredSeriesHistory(def.series,def.lookbackDays)));
  rows.forEach(row=>results.set(row.series,row));
 }
 return results;
}

export async function observedMacroEvidence(now=new Date()){
 const requestedAt=now.toISOString();
 const results=await macroResults();
 const receivedAt=new Date().toISOString();
 const evidence:Evidence[]=[];
 const excluded:string[]=[];
 for(const definition of baseSeries){
  const factor=mapping[definition.series];
  const result=results.get(definition.series);
  const point=result?.status==="ok"&&result.points.length?result.points[result.points.length-1]:null;
  if(!factor||!point||!Number.isFinite(point.value)){excluded.push(definition.series);continue;}
  const observedAt=point.date+"T00:00:00Z";
  if(!Number.isFinite(Date.parse(observedAt))||Date.parse(observedAt)>Date.parse(requestedAt)){excluded.push(definition.series);continue;}
  // Observation date is not assumed to be original public release time; availability begins at retrieval.
  evidence.push({factor,value:point.value,domain:"macro",source:"FRED:"+definition.series,subject:"US_MACRO",observedAt,availableAt:receivedAt});
 }
 const addedFactors:{factor:string;series:string;label:string;unit:string;value:number|null;observedAt:string|null;status:"measured"|"unavailable";reason:string|null}[]=[];
 for(const definition of addedOfficialMacroFactors){
  const result=results.get(definition.series)??{series:definition.series,points:[],status:"empty" as const};
  const derived=deriveOfficialMacroFactor(definition,result);
  addedFactors.push({...definition,value:derived.value,observedAt:derived.observedAt,status:derived.value===null?"unavailable":"measured",reason:derived.reason});
  if(derived.value===null||!derived.observedAt){excluded.push(definition.series);continue;}
  evidence.push({factor:definition.factor,value:derived.value,domain:"macro",source:"FRED:"+definition.series,subject:"US_MACRO",observedAt:derived.observedAt+"T00:00:00Z",availableAt:receivedAt});
 }
 const componentMaps=dxyComponents.map(series=>new Map((results.get(series)?.points??[]).map(point=>[point.date,point.value])));
 if(componentMaps.every(map=>map.size)){
  const common=[...componentMaps[0].keys()].filter(date=>componentMaps.every(map=>map.has(date))).sort();
  const date=common.at(-1);
  if(date){
   const [eurusd,usdjpy,gbpusd,usdcad,usdsek,usdchf]=componentMaps.map(map=>map.get(date)!);
   const dxy=reconstructDxy({eurusd,usdjpy,gbpusd,usdcad,usdsek,usdchf});
   if(dxy!==null)evidence.push({factor:"dxy",value:dxy,domain:"macro",source:"FRED H.10 component rates / ICE USDX formula reconstruction",subject:"DXY_RECONSTRUCTION",observedAt:date+"T00:00:00Z",availableAt:receivedAt});
   else excluded.push("DXY_RECONSTRUCTION_NONFINITE");
  }else excluded.push("DXY_RECONSTRUCTION_NO_COMMON_DATE");
 }else excluded.push("DXY_RECONSTRUCTION_COMPONENT_MISSING");
 const audit=auditEvidence(evidence,receivedAt);
 return {retrievedAt:receivedAt,requestedAt,measured:audit.measured,addedMeasured:addedFactors.filter(x=>x.status==="measured").length,addedTarget:addedOfficialMacroFactors.length,addedFactors,factors:evidence,excluded,audit,backtestEligible:false,approvedForTrading:false,warning:"FRED current-vintage observations: retrieval proves present availability, not historical release availability, predictive usefulness, or independent data vintage."};
}
