import {holmBonferroni} from "./statistical-robustness";

export type HistoricalFactorRecord={
 time:string;symbol:string;horizon:string;label:string;value:number;signedReturn:number;
};

function mean(xs:number[]){return xs.reduce((sum,x)=>sum+x,0)/xs.length}
function median(xs:number[]){const sorted=[...xs].sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null}
function ranks(xs:number[]){
 const ordered=xs.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value),out=Array<number>(xs.length);
 for(let i=0;i<ordered.length;){let j=i+1;while(j<ordered.length&&ordered[j].value===ordered[i].value)j++;const rank=(i+j-1)/2+1;for(let k=i;k<j;k++)out[ordered[k].index]=rank;i=j;}
 return out;
}
function pearson(x:number[],y:number[]){
 if(x.length!==y.length||x.length<3)return null;
 const mx=mean(x),my=mean(y);let xy=0,xx=0,yy=0;
 for(let i=0;i<x.length;i++){const a=x[i]-mx,b=y[i]-my;xy+=a*b;xx+=a*a;yy+=b*b;}
 return xx>0&&yy>0?xy/Math.sqrt(xx*yy):null;
}
function spearman(rows:HistoricalFactorRecord[]){return pearson(ranks(rows.map(x=>x.value)),ranks(rows.map(x=>x.signedReturn)))}
function spread(rows:HistoricalFactorRecord[],threshold:number){
 const high=rows.filter(x=>x.value>threshold).map(x=>x.signedReturn),low=rows.filter(x=>x.value<=threshold).map(x=>x.signedReturn);
 return high.length&&low.length?{value:mean(high)-mean(low),highCount:high.length,lowCount:low.length}:null;
}
function seedFor(label:string){let value=2166136261>>>0;for(const c of label)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;return value;}
function sessionBootstrap(rows:HistoricalFactorRecord[],threshold:number,label:string){
 const grouped=new Map<string,HistoricalFactorRecord[]>();
 for(const row of rows){const day=row.time.slice(0,10),group=grouped.get(day)??[];group.push(row);grouped.set(day,group);}
 const sessions=[...grouped.values()];
 if(sessions.length<5)return {ciLow:null,ciHigh:null,pValue:null,rounds:0,method:"session_cluster_bootstrap"};
 let state=seedFor(label);const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const gains:number[]=[];const rounds=4000;
 for(let round=0;round<rounds;round++){
  const sample:HistoricalFactorRecord[]=[];for(let i=0;i<sessions.length;i++)sample.push(...sessions[Math.floor(random()*sessions.length)]);
  const result=spread(sample,threshold);if(result)gains.push(result.value);
 }
 if(gains.length<rounds*.95)return {ciLow:null,ciHigh:null,pValue:null,rounds:gains.length,method:"session_cluster_bootstrap"};
 gains.sort((a,b)=>a-b);const nonPositive=gains.filter(x=>x<=0).length/gains.length,nonNegative=gains.filter(x=>x>=0).length/gains.length;
 return {ciLow:gains[Math.floor(.025*(gains.length-1))],ciHigh:gains[Math.floor(.975*(gains.length-1))],pValue:Math.min(1,2*Math.min(nonPositive,nonNegative)),rounds:gains.length,method:"session_cluster_bootstrap"};
}

/** Exploratory association search. Results are hypotheses, never model authority. */
export function discoverHistoricalFactorAssociations(raw:HistoricalFactorRecord[]){
 const valid=raw.filter(x=>Number.isFinite(Date.parse(x.time))&&/^[A-Z][A-Z0-9.-]{0,9}$/.test(x.symbol)&&x.label&&Number.isFinite(x.value)&&Number.isFinite(x.signedReturn)).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 const grouped=new Map<string,HistoricalFactorRecord[]>();for(const row of valid){const rows=grouped.get(row.label)??[];rows.push(row);grouped.set(row.label,rows);}
 const preliminary=[...grouped].map(([label,rows])=>{
  const sessions=[...new Set(rows.map(x=>x.time.slice(0,10)))],symbols=new Set(rows.map(x=>x.symbol)).size;
  const threshold=median(rows.map(x=>x.value));const full=threshold===null?null:spread(rows,threshold),rankCorrelation=spearman(rows);
  const cut=Math.max(1,Math.floor(sessions.length*.7)),trainSessions=new Set(sessions.slice(0,cut));
  const training=rows.filter(x=>trainSessions.has(x.time.slice(0,10))),holdout=rows.filter(x=>!trainSessions.has(x.time.slice(0,10)));
  const trainingMedian=median(training.map(x=>x.value)),holdoutResult=trainingMedian===null?null:spread(holdout,trainingMedian);
  const uncertainty=threshold===null?{ciLow:null,ciHigh:null,pValue:null,rounds:0,method:"session_cluster_bootstrap"}:sessionBootstrap(rows,threshold,label);
  return {label,observations:rows.length,sessions:sessions.length,symbols,firstObserved:rows[0]?.time??null,lastObserved:rows.at(-1)?.time??null,
   rankCorrelation,medianSplitReturnSpread:full?.value??null,highCount:full?.highCount??0,lowCount:full?.lowCount??0,
   chronologicalHoldoutSpread:holdoutResult?.value??null,holdoutHighCount:holdoutResult?.highCount??0,holdoutLowCount:holdoutResult?.lowCount??0,
   ...uncertainty};
 });
 const correction=holmBonferroni(preliminary.map(row=>row.pValue??1));
 const findings=preliminary.map((row,index)=>{
  const adjustedPValue=correction.adjusted[index],sameDirection=row.medianSplitReturnSpread!==null&&row.chronologicalHoldoutSpread!==null&&Math.sign(row.medianSplitReturnSpread)===Math.sign(row.chronologicalHoldoutSpread);
  const adequate=row.observations>=60&&row.sessions>=5&&row.symbols>=3;
  const status=adequate&&sameDirection&&adjustedPValue<=.05?"MULTIPLICITY_SURVIVOR":adequate?"EXPLORATORY_ASSOCIATION":"INSUFFICIENT_INDEPENDENT_DEPTH";
  const direction=row.medianSplitReturnSpread===null?"undetermined":row.medianSplitReturnSpread>0?"higher values associated with better direction-adjusted returns":"higher values associated with worse direction-adjusted returns";
  return {...row,adjustedPValue,sameDirection,status,direction,validated:false,eligibleForModelPromotion:false};
 }).sort((a,b)=>a.adjustedPValue-b.adjustedPValue||Math.abs(b.rankCorrelation??0)-Math.abs(a.rankCorrelation??0));
 return {testedFamilySize:findings.length,multiplicityMethod:correction.method,findings,
  policy:"Exploratory point-in-time historical associations only. Session clustering, chronological holdout direction, and family-wide Holm correction reduce false discovery but do not establish causality, stability, profitability, or prospective predictive validity."};
}
