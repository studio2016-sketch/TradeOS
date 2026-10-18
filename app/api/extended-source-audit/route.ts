import {NextResponse} from "next/server";
import {freeOfficialSnapshot} from "../../../lib/market/freeOfficial";
import {latestRegimeContext} from "../../../lib/market/fred";
import {curatedNews} from "../../../lib/market/news";
import {alpacaOptionSurface} from "../../../lib/market/options";
import {featureSet} from "../../../lib/market/features";
import {brokerReadStatus} from "../../../lib/broker/alpaca";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";
export const maxDuration=60;
type Check={category:string;source:string;status:string;sampleCount?:number;observationTime?:string|null;details?:string};
const safe=(e:unknown)=>e instanceof Error?e.message.replace(/(api[_-]?key|token|secret)=([^&\s]+)/gi,"$1=[redacted]").slice(0,160):"Provider request failed";
async function query<T>(name:string,fn:()=>Promise<T>):Promise<{name:string;result:T|null;error:string|null}>{try{return{name,result:await fn(),error:null}}catch(e){return{name,result:null,error:safe(e)}}}
export async function GET(){
 const started=Date.now();
 // Each run verifies upstream responses rather than mere presence of environment variables.
 // No account holdings or credentials are exposed. This endpoint is diagnostic, not authorization.
 const [official,fred,news,options,features,ledger]=await Promise.all([
  query("official",()=>freeOfficialSnapshot(["SPY"])),
  query("fred",()=>latestRegimeContext()),
  query("news",()=>curatedNews(["SPY"],8)),
  query("options",()=>alpacaOptionSurface("SPY")),
  query("features",()=>featureSet("SPY")),
  query("ledger",async()=>{if(!hasDatabase())return null;const sql=db();const rows=await sql`select (select count(*)::int from forecast_ledger) as forecasts,(select count(*)::int from forecast_outcomes) as outcomes,(select max(created_at) from forecast_ledger) as latest_forecast`;return rows[0]??null})
 ]);
 const checks:Check[]=[];
 for(const x of official.result?.sources??[])checks.push({category:"official_macro",source:x.id,status:x.status,observationTime:x.data?.date??x.data?.latest?.date??null,details:x.error??x.note?.slice(0,150)});
 if(official.error)checks.push({category:"official_macro",source:"official_aggregator",status:"error",details:official.error});
 checks.push({category:"economic_series",source:"FRED",status:fred.error?"error":Number((fred.result as any)?.usableCount)>0?"observed":"unavailable",sampleCount:(fred.result as any)?.usableCount??0,details:fred.error??"FRED series observations; use each series observation date for financial interpretation."});
 const fredResults=(fred.result as any)?.diagnostics??[];
 for(const series of fredResults)checks.push({category:"economic_series",source:"FRED:"+series.series,status:series.status==="ok"&&Number.isFinite(series.point?.value)?"observed":series.status==="error"?"error":"unavailable",sampleCount:series.point?1:0,observationTime:series.point?.date??null,details:series.error??(series.point?`Latest observed: ${series.point.value}; not a live tick.`:"No observation")});
 const newsItems=news.result?.news??[];
 checks.push({category:"news",source:"Alpaca + Massive news",status:news.error?"error":newsItems.length?"observed":"unavailable",sampleCount:newsItems.length,observationTime:newsItems.length?newsItems.map((x:any)=>x.timestamp).sort().at(-1):null,details:news.error??news.result?.errors?.join("; ").slice(0,160)??"No news errors"});
 for(const item of newsItems.slice(0,8))checks.push({category:"news_article",source:String(item.source||"unknown"),status:Number.isFinite(Date.parse(String(item.timestamp)))&&Date.parse(String(item.timestamp))<=Date.now()?"dated_observation":"timestamp_invalid",sampleCount:1,observationTime:item.timestamp,details:String(item.headline||"News article").slice(0,140)});
 const o=options.result;
 checks.push({category:"options",source:"Alpaca options chain",status:options.error?"error":o?.contractCount&&o.contractCount>0?"observed":"unavailable",sampleCount:o?.contractCount??0,observationTime:null,details:options.error??(o?"Chain available. Snapshot time per contract not independently certified.":"No provider chain")});
 for(const [metric,value] of Object.entries({atmIv:o?.atmIv,putCallIvSkew:o?.putCallIvSkew,expectedMovePct30d:o?.expectedMovePct30d,averageSpreadPct:o?.averageSpreadPct,liquidityScore:o?.liquidityScore}))checks.push({category:"options_indicator",source:"Alpaca:"+metric,status:typeof value==="number"&&Number.isFinite(value)?"computed_no_contract_timestamp":"unavailable",details:typeof value==="number"&&Number.isFinite(value)?`Value: ${value}; contract-level source timestamp not independently checked.`:"No valid indicator value."});
 const f=features.result;
 checks.push({category:"derived_scores",source:"TradeOS featureSet / Alpaca history",status:features.error?"error":f?.quality?.barCount?"computed_from_history":"unavailable",sampleCount:f?.quality?.barCount??0,observationTime:null,details:features.error??"Model output is not predictive-validation certification; inputs should retain point-in-time audit."});
 for(const [key,value] of Object.entries({dailyTrend:f?.daily?.trendScore,hourlyTrend:f?.hourly?.trendScore,volumeRatio20:f?.daily?.volumeRatio20,realizedVol20Pct:f?.daily?.realizedVol20Pct,coverageScore:f?.quality?.coverageScore}))checks.push({category:"derived_indicator",source:"TradeOS:"+key,status:typeof value==="number"&&Number.isFinite(value)&&Number(f?.quality?.barCount)>0?"computed_not_independently_validated":"unavailable",sampleCount:f?.quality?.barCount??0,details:typeof value==="number"&&Number.isFinite(value)?`Output ${value}; historical inputs present, point-in-time provenance not certified.`:"Cannot verify valid value."});
 const l=ledger.result;
 checks.push({category:"forecast_ledger",source:"Neon Postgres",status:ledger.error?"error":l?"observed":"unavailable",sampleCount:l?.forecasts??0,observationTime:l?.latest_forecast??null,details:ledger.error??(l?`Outcomes: ${l.outcomes??0}; counts alone do not validate returns.`:"Database not available")});
 const broker=brokerReadStatus();
 checks.push({category:"portfolio_metrics",source:"Alpaca account",status:broker.enabled?"read_access_configured_not_validated":"read_access_not_authorized",details:"Account balances, positions, and returns are not publicly queried or certified by this report."});
 const statusCounts=checks.reduce((a:Record<string,number>,c)=>{a[c.status]=(a[c.status]||0)+1;return a},{});
 return NextResponse.json({statusCounts,generatedAt:new Date().toISOString(),durationMs:Date.now()-started,certification:"PARTIAL_SOURCE_CHECK_ONLY",checks,limitations:["Provider configuration alone is not proof of current data.","Official economic observations refresh at publication cadence.","No exchange-level streaming entitlement was established.","No account holdings or sensitive financial details are exposed.","Provider calls may fail or rate limit; no replacement numbers are fabricated.","Article publication timestamps and derivatives remain source assertions until independently reconciled.","Portfolio-return certification requires authenticated balances, positions, and transaction reconciliation."]},{headers:{"Cache-Control":"private, no-store"}});
}
