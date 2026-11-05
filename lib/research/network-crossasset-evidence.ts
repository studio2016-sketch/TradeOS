import {historicalBars,type Bar} from "../market/features";
import type {PersistableEvidence} from "./persist-evidence";
import {createRiskReplayBundle} from "./risk-replay-bundle";
import {synchronizedRiskStatistics} from "./synchronized-risk-statistics";
import {synchronizedRelativeReturn} from "./synchronized-relative-return";

async function massiveGoldPreviousClose(){
 const key=process.env.MASSIVE_API_KEY;
 if(!key)return {value:null as number|null,observedAt:null as string|null,error:"unconfigured"};
 const url=new URL("https://api.massive.com/v2/aggs/ticker/C:XAUUSD/prev");
 url.searchParams.set("adjusted","true");url.searchParams.set("apiKey",key);
 try{
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!res.ok)return {value:null,observedAt:null,error:`http_${res.status}`};
  const payload=await res.json() as {results?:Array<{c?:number;t?:number;o?:number;h?:number;l?:number;v?:number}>};
  const row=payload.results?.[0],value=Number(row?.c),raw=Number(row?.t);
  const observed=Number.isFinite(raw)&&raw>0?new Date(raw>1e14?raw/1e6:raw>1e11?raw:raw*1000):null;
  if(!Number.isFinite(value)||value<=0||!observed||!Number.isFinite(observed.getTime()))return {value:null,observedAt:null,error:"invalid_payload"};
  return {value,observedAt:observed.toISOString(),error:null,metadata:{open:row?.o??null,high:row?.h??null,low:row?.l??null,volume:row?.v??null}};
 }catch(e){return {value:null,observedAt:null,error:e instanceof Error?e.message:"fetch_failed"};}
}

function ret(bars:Bar[],sessions:number){
 if(bars.length<sessions+1)return null;
 const a=bars[bars.length-sessions-1].c,z=bars[bars.length-1].c;
 return a>0?z/a-1:null;
}
const sectorMap:Record<string,string>={NVDA:"XLK",AMD:"XLK",PLTR:"XLK",AAPL:"XLK",MSFT:"XLK",META:"XLC",GOOGL:"XLC",AMZN:"XLY",TSLA:"XLY",JPM:"XLF",XOM:"XLE"};
const industryMap:Record<string,string>={NVDA:"SMH",AMD:"SMH",PLTR:"IGV",AAPL:"VGT",MSFT:"IGV",META:"XLC",GOOGL:"XLC",AMZN:"XLY",TSLA:"CARZ",JPM:"KBE",XOM:"XOP"};

export async function observedNetworkAndCrossAssetEvidence(now=new Date()){
 const feed=process.env.ALPACA_FEED||"iex";
 const availableAt=now.toISOString(),end=availableAt,start=new Date(now.getTime()-180*86400000).toISOString();
 const cache=new Map<string,Bar[]>();
 const get=async(symbol:string)=>{
  if(cache.has(symbol))return cache.get(symbol)!;
  const bars=await historicalBars(symbol,"1Day",start,260,feed,end);
  const complete=bars.filter(b=>Date.parse(b.t)<now.getTime()&&b.t.slice(0,10)<now.toISOString().slice(0,10));
  cache.set(symbol,complete);return complete;
 };
 const candidates:PersistableEvidence[]=[];
 const diagnostics:any[]=[];
 try{
  const gold=await massiveGoldPreviousClose();
  if(gold.value!==null&&gold.observedAt){
   candidates.push({factor:"gold",value:gold.value,source:"Massive Forex:C:XAUUSD previous-day aggregate",subject:"XAUUSD",observedAt:gold.observedAt,availableAt,domain:"macro",metadata:{...(gold.metadata??{}),unit:"USD_per_troy_ounce",market:"forex_XAUUSD",aggregation:"previous_trading_day"}});
  }else diagnostics.push({factor:"gold",error:gold.error});
 }catch(e){diagnostics.push({factor:"gold",error:e instanceof Error?e.message:"unknown"});}
 try{
  const [spy,tlt]=await Promise.all([get("SPY"),get("TLT")]);
  const tlt1=ret(tlt,1);
  if(tlt1!=null&&Number.isFinite(tlt1)&&tlt.length){
   candidates.push({factor:"treasury_etf_return",value:tlt1,source:`Alpaca:${feed}:1Day`,subject:"TLT",observedAt:tlt.at(-1)!.t,availableAt,domain:"stock",metadata:{sessions:1,proxy:"TLT",feed}});
  }
  const risk=synchronizedRiskStatistics(spy,tlt,20);
  if(risk?.correlation!=null){
   candidates.push({factor:"equity_bond_correlation",value:risk.correlation,source:`Alpaca:${feed}:1Day`,subject:"SPY_TLT",observedAt:risk.observedAt,availableAt,domain:"stock",metadata:{riskReplayInputs:risk.inputWindow,equity:"SPY",bond:"TLT",windowSessions:20,sampleCount:risk.sampleCount,sessionDates:risk.sessionDates,method:"synchronized_return_pearson_v2",feed}});
  }else diagnostics.push({factor:"equity_bond_correlation",error:"unaligned_invalid_or_degenerate_session_window"});
  diagnostics.push({pair:"SPY/TLT",spyBars:spy.length,tltBars:tlt.length});
 }catch(e){diagnostics.push({pair:"SPY/TLT",error:e instanceof Error?e.message:"unknown"});}

 try{
  const sectorEtfs=["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"];
  const rows=await Promise.all(sectorEtfs.map(async symbol=>({symbol,bars:await get(symbol)})));
  const latest=rows.flatMap(({symbol,bars})=>{
   const r=ret(bars,1),bar=bars.at(-1);
   return r!=null&&Number.isFinite(r)&&bar?[{symbol,value:r,date:bar.t.slice(0,10),observedAt:bar.t}]:[];
  });
  const counts=new Map<string,number>();for(const x of latest)counts.set(x.date,(counts.get(x.date)??0)+1);
  const commonDate=[...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]))[0]?.[0];
  const sameDay=commonDate?latest.filter(x=>x.date===commonDate):[];
  if(sameDay.length>=8){
   const breadth=sameDay.filter(x=>x.value>0).length/sameDay.length;
   const observedAt=sameDay.map(x=>x.observedAt).sort().at(-1)!;
   candidates.push({factor:"sector_breadth",value:breadth,source:`Alpaca:${feed}:1Day`,subject:"US_SECTOR_ETFS",observedAt,availableAt,domain:"stock",metadata:{method:"fraction_of_sector_etfs_with_positive_completed_session_return",sessionDate:commonDate,constituents:sameDay,unit:"fraction",feed}});
  }
  diagnostics.push({factor:"sector_breadth",eligible:latest.length,commonDate,commonCount:sameDay.length});
 }catch(e){diagnostics.push({factor:"sector_breadth",error:e instanceof Error?e.message:"unknown"});}

 for(const symbol of ["NVDA","AMD","PLTR"]){
  try{
   const [own,spy]=await Promise.all([get(symbol),get("SPY")]);
   const betaRisk=synchronizedRiskStatistics(own,spy,60),correlationRisk=synchronizedRiskStatistics(own,spy,20);
   if(betaRisk?.beta!=null)candidates.push({factor:"beta",value:betaRisk.beta,source:`Alpaca:${feed}:1Day`,subject:symbol,observedAt:betaRisk.observedAt,availableAt,domain:"stock",metadata:{riskReplayInputs:betaRisk.inputWindow,benchmark:"SPY",windowSessions:60,sampleCount:betaRisk.sampleCount,sessionDates:betaRisk.sessionDates,method:"synchronized_return_covariance_over_variance_v2",feed}});
   else diagnostics.push({symbol,factor:"beta",error:"unaligned_invalid_or_degenerate_session_window"});
   if(correlationRisk?.correlation!=null)candidates.push({factor:"rolling_correlation",value:correlationRisk.correlation,source:`Alpaca:${feed}:1Day`,subject:symbol,observedAt:correlationRisk.observedAt,availableAt,domain:"stock",metadata:{riskReplayInputs:correlationRisk.inputWindow,benchmark:"SPY",windowSessions:20,sampleCount:correlationRisk.sampleCount,sessionDates:correlationRisk.sessionDates,method:"synchronized_return_pearson_v2",feed}});
   else diagnostics.push({symbol,factor:"rolling_correlation",error:"unaligned_invalid_or_degenerate_session_window"});
  }catch(e){diagnostics.push({symbol,riskContextError:e instanceof Error?e.message:"unknown"});}
 }

 for(const symbol of ["NVDA","AMD","PLTR"]){
  try{
   const sector=sectorMap[symbol],industry=industryMap[symbol];
   const names=[symbol,sector,industry].filter(Boolean);
   const rows=await Promise.all(names.map(get));
   const own=rows[0];
   if(sector){
    const relative=synchronizedRelativeReturn(own,rows[1]);
    if(relative)candidates.push({factor:"sector_relative_return",value:relative.value,source:`Alpaca:${feed}:1Day`,subject:symbol,observedAt:relative.observedAt,availableAt,domain:"stock",metadata:{symbolReturn20:relative.ownReturn,sectorProxy:sector,sectorReturn20:relative.proxyReturn,windowSessions:20,sessionDates:relative.sessionDates,method:"same_session_endpoint_relative_return_v2",feed}});
    else diagnostics.push({symbol,factor:"sector_relative_return",error:"unaligned_or_invalid_session_window"});
   }
   if(industry){
    const idx=sector===industry?1:2,relative=synchronizedRelativeReturn(own,rows[idx]);
    if(relative)candidates.push({factor:"industry_relative_return",value:relative.value,source:`Alpaca:${feed}:1Day`,subject:symbol,observedAt:relative.observedAt,availableAt,domain:"stock",metadata:{symbolReturn20:relative.ownReturn,industryProxy:industry,industryReturn20:relative.proxyReturn,windowSessions:20,sessionDates:relative.sessionDates,method:"same_session_endpoint_relative_return_v2",feed}});
    else diagnostics.push({symbol,factor:"industry_relative_return",error:"unaligned_or_invalid_session_window"});
   }
  }catch(e){diagnostics.push({symbol,error:e instanceof Error?e.message:"unknown"});}
 }
 // Availability starts after every input has actually been retrieved, never
 // at request start. This is receipt evidence, not publication-time certification.
 const retrievedAt=new Date().toISOString();
 return {requestedAt:availableAt,retrievedAt,candidates:candidates.map(candidate=>{
  const row={...candidate,availableAt:retrievedAt};
  const {riskReplayInputs,...metadata}=row.metadata??{};
  if(riskReplayInputs){
   const {factor,subject,source,value,observedAt,availableAt}=row;
   metadata.riskReplay=createRiskReplayBundle({factor,subject,source,value,observedAt,availableAt},riskReplayInputs as Parameters<typeof createRiskReplayBundle>[1],{
    ownSymbol:factor==="equity_bond_correlation"?"SPY":subject,benchmarkSymbol:factor==="equity_bond_correlation"?"TLT":"SPY",feed
   });
  }
  return {...row,metadata};
 }),diagnostics};
}
