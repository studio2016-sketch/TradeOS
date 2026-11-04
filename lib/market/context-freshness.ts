import type {FeatureSet} from "./features";

const broadSymbols=["SPY","QQQ","IWM"] as const;
export function broadIntradayContext(by:ReadonlyMap<string,FeatureSet|null|undefined>,now=Date.now()){
  const inputs=broadSymbols.map(symbol=>{
    const data=by.get(symbol),sourceTimestamp=data?.quality?.latestIntradayBar??null;
    const stamp=Date.parse(sourceTimestamp??"");
    const ageMs=Number.isFinite(stamp)&&stamp>0?now-stamp:null;
    const score=data?.intraday?.trendScore;
    const reason=!data?"missing_features":ageMs===null?"invalid_or_missing_timestamp":ageMs<0?"future_observation":ageMs>=20*60_000?"stale_observation":data.quality.underlyingDataCurrent!==true?"not_current":typeof score!=="number"||!Number.isFinite(score)?"invalid_or_missing_score":"recent_observation";
    return {symbol,sourceTimestamp,featureGeneratedAt:data?.generatedAt??null,ageMs,eligible:reason==="recent_observation",reason,score};
  });
  const eligibleCount=inputs.filter(input=>input.eligible).length;
  return {
    // A subset of broad indices must not stand in for complete broad internals.
    score:eligibleCount===broadSymbols.length?inputs.reduce((sum,input)=>sum+input.score!,0)/broadSymbols.length:null,
    quality:{eligibleCount,requiredCount:broadSymbols.length,inputs:inputs.map(({score,...input})=>input),
      note:"Only broad intraday internals are freshness-gated here. generatedAt is calculation time; provider bar timestamps do not certify real-time entitlement or point-in-time availability."}
  };
}
