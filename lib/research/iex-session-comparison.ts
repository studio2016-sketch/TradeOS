import {checkRiskReplayBundle} from "./risk-replay-bundle";

/** Manually transcribed and separately reviewed from the official IEX page.
 * The current page is NOT evidence of what calendar was published historically.
 */
export const IEX_2026_REGULAR_SCHEDULE={
 venue:"IEX",coverageStart:"2026-01-01",coverageEnd:"2026-12-31",
 sourceUrl:"https://www.iex.io/resources/trading/trading-hours-holidays",
 capturedAt:"2026-11-05T21:54:37.095Z",sourcePublishedAt:null,
 sourceHtmlSha256:"ed29c1d9ab57fe7562ebc9980452c420569185d3b13dc4d9288d88df59a6ea22",
 transcription:"manual-reviewed-2026-v1",
 fullClosures:["2026-01-01","2026-01-19","2026-02-16","2026-04-03","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-11-26","2026-12-25"],
 earlyCloses:["2026-11-27","2026-12-24"],
} as const;
const flags={feedCompletenessCertified:false,sourceTimeCertified:false,independentReplayVerified:false,liveExecutionAllowed:false};
const exchangeDayFormatter=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"});
function day(value:unknown){
 if(typeof value!=="string"||!Number.isFinite(Date.parse(value)))return null;
 const parts=exchangeDayFormatter.formatToParts(new Date(value));
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part("year")}-${part("month")}-${part("day")}`;
}
const iso=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;

/** Compare each retained input leg to regular scheduled dates BETWEEN its
 * captured endpoints only. Does not infer request cutoff, freshness or missing
 * prefixes/suffixes. An open exchange does not guarantee a symbol has an IEX bar.
 */
export function compareIexCapturedSessions(input:unknown){
 const fail=(reason:string)=>({status:"UNVERIFIED" as const,reason,...flags});
 try{
  if(!input||typeof input!=="object")return fail("INVALID_EXPORTED_ROW");
  const x=input as Record<string,any>,observedAt=iso(x.observed_at),availableAt=iso(x.available_at);
  if(!observedAt||!availableAt)return fail("INVALID_EXPORTED_ROW");
  const row={factor:x.factor_key,subject:x.subject,source:x.source_name,value:x.value,observedAt,availableAt};
  const b=x.source_metadata?.riskReplay;
  const integrity=checkRiskReplayBundle(b,row);
  if(integrity.status!=="REPRODUCED")return fail(integrity.reason);
  if(b.payload.identity.feed!=="iex")return fail("UNSUPPORTED_FEED_CALENDAR");
  const own=b.payload.inputWindow.own.map((bar:any)=>day(bar.t)) as string[],benchmark=b.payload.inputWindow.benchmark.map((bar:any)=>day(bar.t)) as string[];
  if([own,benchmark].some(dates=>dates.some((date,i)=>!date||(i>0&&date<=dates[i-1]))))return fail("INVALID_EXCHANGE_SESSION_SEQUENCE");
  if(own.some((date,i)=>date!==benchmark[i]))return fail("EXCHANGE_SESSION_DATE_PAIR_MISMATCH");
  const start=own[0],end=own.at(-1)!;
  if(!start||!end||start<IEX_2026_REGULAR_SCHEDULE.coverageStart||end>IEX_2026_REGULAR_SCHEDULE.coverageEnd)return fail("OUTSIDE_PINNED_CALENDAR_COVERAGE");
  const expected:string[]=[];
  for(let t=Date.parse(start+'T00:00:00Z');t<=Date.parse(end+'T00:00:00Z');t+=86400000){
   const date=new Date(t),key=date.toISOString().slice(0,10),weekday=date.getUTCDay();
   if(weekday!==0&&weekday!==6&&!(IEX_2026_REGULAR_SCHEDULE.fullClosures as readonly string[]).includes(key))expected.push(key);
  }
  const compare=(observed:string[])=>({observedCount:observed.length,missingScheduledDates:expected.filter(d=>!observed.includes(d)),unexpectedDates:observed.filter(d=>!expected.includes(d))});
  const legs={own:compare(own),benchmark:compare(benchmark)};
  const matches=Object.values(legs).every(leg=>!leg.missingScheduledDates.length&&!leg.unexpectedDates.length);
  return {status:matches?"REGULAR_SCHEDULE_MATCH" as const:"REGULAR_SCHEDULE_DEVIATION" as const,
   factor:row.factor,subject:row.subject,intervalStart:start,intervalEnd:end,expectedCount:expected.length,legs,
   calendar:IEX_2026_REGULAR_SCHEDULE,scope:"CAPTURED_ENDPOINT_INTERVAL_ONLY",...flags};
 }catch{return fail("INVALID_EXPORTED_ROW");}
}
