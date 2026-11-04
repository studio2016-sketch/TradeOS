import {featureSet,type FeatureSet} from "./features";

export type FeatureSetLoader=(symbol:string)=>Promise<FeatureSet|null>;

/** Create inside a request/collector run, never at module scope.
 * Share each symbol's feature calculation (including failure) only within that
 * operation. No successful observations survive into a later request/run.
 */
export function createRequestFeatureLoader(load:FeatureSetLoader=featureSet,now:()=>number=Date.now):FeatureSetLoader{
  const pending=new Map<string,Promise<FeatureSet|null>>();
  return async(symbol:string)=>{
    let task=pending.get(symbol);
    if(!task){
      task=Promise.resolve().then(()=>load(symbol));
      pending.set(symbol,task);
    }
    const result=await task;
    if(!result)return null;
    // Consumers receive independent objects; one calculation cannot mutate another.
    const copy=structuredClone(result);
    const stamp=Date.parse(copy.quality.latestIntradayBar??"");
    const elapsed=Number.isFinite(stamp)?now()-stamp:null;
    copy.quality.intradayAgeMs=elapsed===null?null:Math.max(0,elapsed);
    // A long collector run must not keep an expired current flag. Never promote
    // an originally non-current result or relabel the original generatedAt time.
    copy.quality.underlyingDataCurrent=copy.quality.underlyingDataCurrent&&elapsed!==null&&elapsed>=0&&elapsed<20*60_000;
    return copy;
  };
}
