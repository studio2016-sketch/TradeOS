import type {MarketSnapshot} from "./types";

export type DualSourceStatus="verified"|"unverified"|"disputed"|"stale";
export type DualSourceResult={
 symbol:string; status:DualSourceStatus; certifiedDataEligible:boolean;
 sources:string[]; discrepancyBps:number|null; reasons:string[]; checkedAt:string;
};
export type DualSourcePolicy={maxAgeMs:number;maxSkewMs:number;maxDifferenceBps:number};
export const DEFAULT_POLICY:DualSourcePolicy={maxAgeMs:60_000,maxSkewMs:15_000,maxDifferenceBps:25};
const sourceFamily=(x:MarketSnapshot)=>x.source.split(":")[0].toLowerCase();
const time=(x:MarketSnapshot)=>Date.parse(x.timestamp);
const fresh=(x:MarketSnapshot,now:number,p:DualSourcePolicy)=>Number.isFinite(x.price)&&x.price>0&&Number.isFinite(time(x))&&time(x)<=now+1000&&now-time(x)<=p.maxAgeMs;
const consolidated=(x:MarketSnapshot)=>!/iex only|partial|delayed/i.test((x.coverage??"")+" "+(x.entitlement??""));

/** Independent-feed agreement is necessary, not sufficient, for certified use.
 * Entitlements, security identity, corporate actions and market-hours rules
 * must be validated separately. Fail closed when any check cannot be established.
 */
export function reconcileDualSource(symbol:string,observations:MarketSnapshot[],now=Date.now(),policy:DualSourcePolicy=DEFAULT_POLICY):DualSourceResult {
 const candidates=observations.filter(x=>x.symbol.toUpperCase()===symbol.toUpperCase()).sort((a,b)=>time(b)-time(a));
 const primary=candidates[0];
 const second=primary?candidates.find(x=>sourceFamily(x)!==sourceFamily(primary)):undefined;
 const sources=[primary?.source,second?.source].filter((x):x is string=>Boolean(x));
 let status:DualSourceStatus="unverified",discrepancyBps:number|null=null;
 let reason="Independent eligible observations are unavailable.";
 if(!primary||!fresh(primary,now,policy)){status="stale";reason="Primary observation is missing, invalid, stale or future-dated.";}
 else if(!second||!fresh(second,now,policy)){reason="A fresh independent secondary observation is missing.";}
 else if(!consolidated(primary)||!consolidated(second)){reason="Partial or delayed feed cannot certify consolidated-price agreement.";}
 else if(primary.priceKind!==second.priceKind){reason="Provider price kinds differ.";}
 else if(Math.abs(time(primary)-time(second))>policy.maxSkewMs){reason="Source timestamps are too far apart.";}
 else {
   discrepancyBps=10000*Math.abs(primary.price-second.price)/((primary.price+second.price)/2);
   if(discrepancyBps>policy.maxDifferenceBps){status="disputed";reason="Provider discrepancy exceeds tolerance.";}
   else {status="verified";reason="Two independent comparable observations agree within tolerance.";}
 }
 return {symbol:symbol.toUpperCase(),status,certifiedDataEligible:status==="verified",sources,discrepancyBps,reasons:[reason],checkedAt:new Date(now).toISOString()};
}
