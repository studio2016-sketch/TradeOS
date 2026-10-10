import type {SourceHealth} from "./types";
export const providerRegistry=[
 {id:"massive",label:"Massive / SIP equities",role:"Primary consolidated U.S. equities trades, quotes and bars",env:"MASSIVE_API_KEY"},
 {id:"alpaca",label:"Alpaca Market Data",role:"Secondary equities, options, streaming news and sandbox",env:"ALPACA_API_KEY"},
 {id:"sec",label:"SEC EDGAR",role:"Authoritative company filings and disclosure catalysts",env:null},
 {id:"fred",label:"FRED / Federal Reserve data",role:"Daily volatility and interest-rate regime context",env:null},
 {id:"cboe",label:"Cboe volatility",role:"VIX family, term structure and volatility context",env:null},
 {id:"macro",label:"BLS Macro Calendar",role:"Official scheduled U.S. labor and inflation release risk",env:null},
 {id:"cftc",label:"CFTC Positioning",role:"Official dealer, asset-manager and leveraged-money futures positioning",env:null},
 {id:"finra",label:"FINRA Equity Transparency",role:"Official Reg SHO short volume and consolidated short interest",env:null},
 {id:"treasury",label:"U.S. Treasury Yield Curve",role:"Official daily par-yield curve confirmation",env:null},
 {id:"bls-data",label:"BLS Economic Series",role:"Official CPI, PPI, payroll, unemployment, wages and job openings",env:null},
 {id:"alfred",label:"FRED / ALFRED Vintage Data",role:"Revision-aware macro backtesting",env:"FRED_API_KEY"},
 {id:"bea",label:"BEA Economic Data",role:"GDP, income and industry data",env:"BEA_API_KEY"},
 {id:"eia",label:"EIA Energy Data",role:"Petroleum inventories and energy fundamentals",env:"EIA_API_KEY"}
] as const;
export function configuredSourceHealth():SourceHealth[]{
 return providerRegistry.map(p=>{
  const configured=p.id==="alpaca"?Boolean(process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET):p.env?Boolean(process.env[p.env]):false;
  const publicAvailable=!p.env;
  const adapterActive=["sec","fred","macro","cftc","finra","treasury","bls-data","cboe"].includes(p.id);
  return{id:p.id,label:p.label,state:configured?"live":adapterActive?"live":publicAvailable?"available":"unconfigured",quality:configured?85:adapterActive?90:publicAvailable?70:0,authoritative:["sec","cboe","fred","macro","cftc","finra","treasury","bls-data","alfred","bea","eia"].includes(p.id),note:configured?p.role:adapterActive?p.role:publicAvailable?"Public source available; live adapter not yet activated":"Credential required before live ingestion"};
 });
}
