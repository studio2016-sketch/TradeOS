export const TRIAL_ACTIVATION="2026-10-19T13:30:00.000Z";
// Clean certification epoch begins only after the challenger immutable-write bug was fixed and deployed.
// Earlier prospective forecasts remain valid research history but are excluded from certification because some challenger rows lack contemporaneous immutable records.
export const CERTIFICATION_ACTIVATION="2026-10-21T17:15:00.000Z";
export const BASELINE_VERSION="shadow-trend-v1";
export const CHALLENGER_VERSION="shadow-trend-v2-frozen-20261018";
/** Prospectively specified and frozen before October 19 market session.
 * This is a challenger hypothesis, not evidence of an advantage.
 */
export function challengerProbability(input:{return75m:number;vwapAligned:boolean|null;spreadRatio:number|null;quality:number}){
 const {return75m,vwapAligned,spreadRatio,quality}=input;
 if(!Number.isFinite(return75m)||!Number.isFinite(quality))return null;
 if(spreadRatio!==null&&!Number.isFinite(spreadRatio))return null;
 let score=.50+Math.min(.075,Math.abs(return75m)*2.5);
 if(vwapAligned===true)score+=.025;
 if(vwapAligned===false)score-=.035;
 if(spreadRatio!==null&&spreadRatio>.0015)score-=.035;
 if(quality<.6)score-=.025;
 return Math.max(.50,Math.min(.64,score));
}
