type CloseBar={t:string;c:number};

/** Compare the same completed-session endpoints and intervening session dates.
 * Missing observations are not bridged or replaced with zero returns.
 */
export function synchronizedRelativeReturn(own:CloseBar[],proxy:CloseBar[],sessions=20){
 if(!Number.isInteger(sessions)||sessions<1)return null;
 const window=(bars:CloseBar[])=>{
  if(bars.some(b=>!Number.isFinite(Date.parse(b.t))))return null;
  const ordered=[...bars].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t)).slice(-(sessions+1));
  if(ordered.length!==sessions+1||ordered.some(b=>!Number.isFinite(b.c)||b.c<=0))return null;
  const dates=ordered.map(b=>new Date(b.t).toISOString().slice(0,10));
  if(new Set(dates).size!==dates.length)return null;
  return {ordered,dates};
 };
 const a=window(own),b=window(proxy);
 if(!a||!b||a.dates.some((date,i)=>date!==b.dates[i]))return null;
 const ownReturn=a.ordered.at(-1)!.c/a.ordered[0].c-1;
 const proxyReturn=b.ordered.at(-1)!.c/b.ordered[0].c-1;
 const value=ownReturn-proxyReturn;
 if(![ownReturn,proxyReturn,value].every(Number.isFinite))return null;
 return {value,ownReturn,proxyReturn,sessionDates:a.dates,
  observedAt:new Date(Math.max(Date.parse(a.ordered.at(-1)!.t),Date.parse(b.ordered.at(-1)!.t))).toISOString()};
}
