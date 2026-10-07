import type {SourceHealth} from "./types";
export const providerRegistry=[
 {id:"massive",label:"Massive / SIP equities",role:"Primary consolidated U.S. equities trades, quotes and bars",env:"MASSIVE_API_KEY"},
 {id:"alpaca",label:"Alpaca Market Data",role:"Secondary equities, options, streaming news and sandbox",env:"ALPACA_DATA_KEY"},
 {id:"sec",label:"SEC EDGAR",role:"Authoritative company filings and disclosure catalysts",env:null},
 {id:"cboe",label:"Cboe volatility",role:"VIX family, term structure and volatility context",env:null},
 {id:"macro",label:"Macro calendar provider",role:"Scheduled economic events and consensus/actual values",env:"MACRO_DATA_API_KEY"}
] as const;
export function configuredSourceHealth():SourceHealth[]{
 return providerRegistry.map(p=>{
  const configured=p.env?Boolean(process.env[p.env]):true;
  return{id:p.id,label:p.label,state:configured?"live":"unconfigured",quality:configured?85:0,authoritative:p.id==="sec"||p.id==="cboe",note:configured?p.role:"Credential required before live ingestion"};
 });
}
