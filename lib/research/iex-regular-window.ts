import {IEX_2026_REGULAR_SCHEDULE} from './iex-session-comparison';

const million=BigInt(1000000);
const local=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function parts(t:number){const p=local.formatToParts(new Date(t));const get=(s:string)=>p.find(x=>x.type===s)!.value;return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour')),minute:Number(get('minute'))};}
/** Current pinned regular schedule comparison only. Post-market trading is not classified as exchange closure. */
export function iexRegularWindow(start:bigint,end:bigint){
 const unknown={opportunity:'UNKNOWN' as const,scope:'REGULAR_SCHEDULE_ONLY',historicalPublicationCertified:false};
 const a=Number(start/million),b=Number(end/million);
 if(start>end||!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||Math.abs(a)>8640000000000000||Math.abs(b)>8640000000000000)return unknown;
 const from=parts(a),to=parts(b),calendar=IEX_2026_REGULAR_SCHEDULE;
 if(from.date!==to.date||from.date<calendar.coverageStart||from.date>calendar.coverageEnd)return unknown;
 const weekday=new Date(from.date+'T12:00:00Z').getUTCDay();
 const closed=[0,6].includes(weekday)||(calendar.fullClosures as readonly string[]).includes(from.date);
 if(closed)return {...unknown,opportunity:'NONE' as const,exchangeDate:from.date,reason:'NO_PINNED_REGULAR_SESSION'};
 // At noon UTC, New York's same-day clock safely exposes its DST offset.
 const noon=Date.parse(from.date+'T12:00:00Z'),offsetHours=parts(noon).hour-12;
 const early=(calendar.earlyCloses as readonly string[]).includes(from.date),closeHour=early?13:16;
 const openMs=Date.parse(from.date+'T09:30:00Z')-offsetHours*3600000,closeMs=Date.parse(from.date+`T${closeHour}:00:00Z`)-offsetHours*3600000;
 const open=BigInt(openMs)*million,close=BigInt(closeMs)*million;
 const overlapStart=start>open?start:open,overlapEnd=end<close?end:close;
 const opportunity=overlapEnd<overlapStart?'NONE':overlapEnd===overlapStart?'BOUNDARY_ONLY':start>=open&&end<=close?'FULL':'PARTIAL';
 return {...unknown,opportunity,exchangeDate:from.date,regularOpen:new Date(openMs).toISOString(),regularClose:new Date(closeMs).toISOString(),earlyClose:early,
  overlapNanoseconds:overlapEnd>overlapStart?(overlapEnd-overlapStart).toString():'0',reason:'PINNED_REGULAR_HOURS_COMPARISON_NOT_FEED_AVAILABILITY'};
}
