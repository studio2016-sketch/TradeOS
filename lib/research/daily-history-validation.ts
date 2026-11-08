import type {PriceBar} from './market-factor-engine';

/** Validate all provider rows before selecting completed dates. Never repair malformed history. */
export function validateDailyHistory(bars:unknown):bars is PriceBar[]{
 if(!Array.isArray(bars))return false;
 const dates=new Set<string>();
 for(const b of bars){
  if(!b||typeof b!=='object'||typeof b.timestamp!=='string')return false;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(b.timestamp);
  if(!match)return false;
  const [y,m,d,h,mi,s]=match.slice(1,7).map(Number),day=new Date(Date.UTC(y,m-1,d));
  const instant=Date.parse(b.timestamp);
  if(y<1000||day.getUTCFullYear()!==y||day.getUTCMonth()!==m-1||day.getUTCDate()!==d||h>23||mi>59||s>59||!Number.isFinite(instant))return false;
  if(![b.open,b.high,b.low,b.close,b.volume].every(v=>typeof v==='number'&&Number.isFinite(v))||b.low<=0||b.high<b.low||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high||b.volume<0)return false;
  const date=new Date(instant).toISOString().slice(0,10);
  if(dates.has(date))return false;
  dates.add(date);
 }
 return true;
}
export function completedDailyHistory(bars:PriceBar[],cutoff:number){
 const nyDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(cutoff));
 return bars.filter(b=>new Date(b.timestamp).toISOString().slice(0,10)<nyDay&&Date.parse(b.timestamp)<cutoff).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
}
