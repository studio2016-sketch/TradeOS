export type Protocol={trainStart:string;trainEnd:string;holdoutStart:string;holdoutEnd:string;primaryMetric:string;baseline:string;pointInTime:boolean;independentSource:boolean;costs:boolean;multipleTesting:boolean;independentReplay:boolean;holdoutLocked:boolean};
export function reviewPreflight(p:Protocol){
 const issues:string[]=[];
 for(const k of ["trainStart","trainEnd","holdoutStart","holdoutEnd"] as const)if(!/^\d{4}-\d{2}-\d{2}$/.test(p[k])||!Number.isFinite(Date.parse(p[k])))issues.push("Invalid "+k);
 if(!(Date.parse(p.trainStart)<Date.parse(p.trainEnd)&&Date.parse(p.trainEnd)<Date.parse(p.holdoutStart)&&Date.parse(p.holdoutStart)<Date.parse(p.holdoutEnd)))issues.push("Untouched chronological holdout is required");
 if(!p.primaryMetric?.trim()||!p.baseline?.trim())issues.push("Prespecify primary metric and baseline");
 if(!p.pointInTime)issues.push("Point-in-time provenance unverified");
 if(!p.independentSource)issues.push("Independent source missing");
 if(!p.costs)issues.push("Realistic costs unverified");
 if(!p.multipleTesting)issues.push("Multiple testing correction missing");
 if(!p.independentReplay)issues.push("Independent replay missing");
 if(!p.holdoutLocked)issues.push("Holdout lock unverified");
 return {issues,readyForIndependentReview:issues.length===0,modelEligible:false,scientificallyCertified:false};
}
