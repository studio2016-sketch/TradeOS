export const macroSourceCatalog=[
{id:"FED",name:"Federal Reserve",area:"US monetary policy",url:"https://www.federalreserve.gov/monetarypolicy.htm",family:"official_us",drivers:["policy_rate","liquidity","inflation_expectations"]},
{id:"FRED",name:"St. Louis Fed FRED",area:"US and international time series",url:"https://fred.stlouisfed.org/",family:"official_us",drivers:["rates","credit_spreads","labor","yield_curve"]},
{id:"SEC",name:"SEC EDGAR / XBRL",area:"Company filings and fundamentals",url:"https://data.sec.gov/",family:"official_us",drivers:["earnings","guidance","balance_sheet","filings"]},
{id:"BLS",name:"Bureau of Labor Statistics",area:"Employment and inflation",url:"https://www.bls.gov/",family:"official_us",drivers:["cpi","labor","wages"]},
{id:"BEA",name:"Bureau of Economic Analysis",area:"Growth and consumption",url:"https://www.bea.gov/",family:"official_us",drivers:["gdp","pce","income"]},
{id:"UST",name:"US Treasury Fiscal Data",area:"Federal financing",url:"https://fiscaldata.treasury.gov/",family:"official_us",drivers:["treasury_supply","deficits","federal_debt"]},
{id:"NYFED",name:"Federal Reserve Bank of New York",area:"Market operations and funding",url:"https://www.newyorkfed.org/markets",family:"official_us",drivers:["repo","funding","liquidity"]},
{id:"ECB",name:"European Central Bank",area:"Euro area monetary policy",url:"https://www.ecb.europa.eu/",family:"official_eu",drivers:["eur_rates","fx","liquidity"]},
{id:"BOE",name:"Bank of England",area:"UK monetary policy",url:"https://www.bankofengland.co.uk/",family:"official_uk",drivers:["gbp_rates","fx"]},
{id:"BOJ",name:"Bank of Japan",area:"Japanese policy",url:"https://www.boj.or.jp/en/",family:"official_jp",drivers:["jpy_rates","fx","carry_trades"]},
{id:"BIS",name:"Bank for International Settlements",area:"Global banking and credit",url:"https://www.bis.org/",family:"multilateral",drivers:["banking","cross_border_credit"]},
{id:"IMF",name:"International Monetary Fund",area:"Global growth and financial stability",url:"https://www.imf.org/",family:"multilateral",drivers:["global_growth","sovereign_risk"]},
{id:"WORLD_BANK",name:"World Bank",area:"Global macro and development",url:"https://data.worldbank.org/",family:"multilateral",drivers:["growth","trade","commodities"]},
{id:"EIA",name:"US Energy Information Administration",area:"Energy supply and demand",url:"https://www.eia.gov/",family:"official_us",drivers:["oil","gas","energy_inflation"]},
{id:"CFTC",name:"Commodity Futures Trading Commission",area:"Futures positioning",url:"https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",family:"official_us",drivers:["positioning","futures_liquidity"]},
{id:"REUTERS",name:"Reuters",area:"Cross-checked market news",url:"https://www.reuters.com/markets/",family:"independent_news",drivers:["geopolitics","earnings","policy","energy"]}
] as const;
export type MarketEvent={id:string;headline:string;sourceId:string;publishedAt:string;firstObservedAt:string;instruments:string[];drivers:string[];impactHypothesis:string;corroboratingSourceIds:string[]};
export function classifyNewsEvidence(item:MarketEvent,now:string){
 const reasons:string[]=[];const published=Date.parse(item.publishedAt),observed=Date.parse(item.firstObservedAt),clock=Date.parse(now);
 if(!item.id||!item.headline||!item.impactHypothesis)reasons.push("Missing identity, description or falsifiable hypothesis");
 if(!macroSourceCatalog.some(s=>s.id===item.sourceId))reasons.push("Unknown source");
 if(!Number.isFinite(published)||!Number.isFinite(observed)||!Number.isFinite(clock)||published>observed||observed>clock+5000)reasons.push("Invalid publication or observation chronology");
 if(!item.instruments.length||!item.drivers.length)reasons.push("No declared security mapping or transmission channel");
 const distinct=new Set(item.corroboratingSourceIds.filter(s=>s!==item.sourceId));
 const families=new Set(macroSourceCatalog.filter(s=>distinct.has(s.id)).map(s=>s.family));
 if(!families.size)reasons.push("No independent source family corroboration");
 return {admissibleAsResearchLead:reasons.length===0,issues:reasons,predictiveSignalApproved:false,canTriggerTrade:false};
}
