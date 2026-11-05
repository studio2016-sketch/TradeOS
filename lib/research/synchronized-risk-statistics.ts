type CloseBar={t:string;c:number};

/** Pair returns only when both their start and end observations match.
 * A complete common window is required; this is not an exchange-calendar certificate.
 */
export function synchronizedRiskStatistics(own:CloseBar[],benchmark:CloseBar[],sessions:number){
 if(!Number.isInteger(sessions)||sessions<2)return null;
 const window=(bars:CloseBar[])=>{
  if(bars.some(b=>!Number.isFinite(Date.parse(b.t))))return null;
  const ordered=[...bars].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t)).slice(-(sessions+1));
  if(ordered.length!==sessions+1||ordered.some(b=>!Number.isFinite(b.c)||b.c<=0))return null;
  const dates=ordered.map(b=>new Date(b.t).toISOString().slice(0,10));
  if(new Set(dates).size!==dates.length)return null;
  return {ordered,dates};
 };
 const a=window(own),b=window(benchmark);
 if(!a||!b||a.dates.some((date,i)=>date!==b.dates[i]))return null;
 const returns=(bars:CloseBar[])=>bars.slice(1).map((bar,i)=>bar.c/bars[i].c-1);
 const x=returns(a.ordered),y=returns(b.ordered);
 if(![...x,...y].every(Number.isFinite))return null;
 const mx=x.reduce((sum,v)=>sum+v,0)/sessions,my=y.reduce((sum,v)=>sum+v,0)/sessions;
 let cov=0,vx=0,vy=0;
 for(let i=0;i<sessions;i++){const dx=x[i]-mx,dy=y[i]-my;cov+=dx*dy;vx+=dx*dx;vy+=dy*dy;}
 if(![cov,vx,vy].every(Number.isFinite))return null;
 const beta=vy>0?cov/vy:null;
 const correlation=vx>0&&vy>0?(cov/Math.sqrt(vx))/Math.sqrt(vy):null;
 return {beta:beta!==null&&Number.isFinite(beta)?beta:null,
  correlation:correlation!==null&&Number.isFinite(correlation)?Math.max(-1,Math.min(1,correlation)):null,
  sampleCount:sessions,sessionDates:a.dates,
  observedAt:new Date(Math.max(Date.parse(a.ordered.at(-1)!.t),Date.parse(b.ordered.at(-1)!.t))).toISOString()};
}
