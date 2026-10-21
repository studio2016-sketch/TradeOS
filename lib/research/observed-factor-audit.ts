import {assessCrossDomainCoverage} from "./cross-domain-coverage";
import {FACTOR_KEYS} from "./acceleration-factors";
export function summarizeStoredMarketRecords(rows:Array<{market_time:string;provider:string;features:Record<string,number|null>}>,asOf:string){
 const direct=new Set(["daily_volume","dollar_volume","distance_vwap","bid_ask_spread","spread_bps","quoted_depth","order_imbalance"]);
 const records=rows.flatMap(r=>Object.entries(r.features).filter(([key,value])=>direct.has(key)&&(FACTOR_KEYS as readonly string[]).includes(key)&&typeof value==="number"&&Number.isFinite(value)).map(([key,value])=>({key,value:value as number,source:r.provider,observedAt:r.market_time,applicableTo:"stock" as const})));
 const audit=assessCrossDomainCoverage(records,asOf);
 return {measured:audit.measured,missing:audit.missing,byDomain:audit.byDomain,recordsExamined:rows.length,approvedForTrading:false,scope:"Direct market fields only; economic, company, option and portfolio contexts remain unverified"};
}
