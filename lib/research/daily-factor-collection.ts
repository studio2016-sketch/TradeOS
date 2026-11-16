import {createHash} from 'node:crypto';
import {IEX_2026_REGULAR_SCHEDULE as calendar} from './iex-session-comparison';
import {calculateMarketFactors} from './market-factor-engine';
import {validateDailyHistory} from './daily-history-validation';
import type {HistoryResult} from './market-factor-history';
import type {PersistableEvidence} from './persist-evidence';
import {evidenceTimestamp} from './evidence-time';
import {validateEvidence} from './evidence-gate';

export const DAILY_COLLECTION_POLICY='tradeos.daily-factors.iex-three-symbols.v1';
export const DAILY_SYMBOLS=['NVDA','AMD','PLTR'] as const;
export const DAILY_KEYS=[
 'sma_5','sma_20','sma_50','sma_200','return_1d','return_5d','intraday_range','dollar_volume','gap_pct','price_acceleration',
 'relative_volume','atr_14','realized_vol_5','realized_vol_20','volatility_regime','vol_of_vol','ema_9','ema_21','macd','macd_signal',
 'adx','breakout_strength','overnight_vol','gap_frequency',
] as const;
const ny=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(date:Date){const p=Object.fromEntries(ny.formatToParts(date).map(x=>[x.type,x.value]));return {day:`${p.year}-${p.month}-${p.day}`,hour:p.hour,minute:p.minute,second:p.second};}
export function isPinnedSession(day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||evidenceTimestamp(day+'T00:00:00Z')===null||day<calendar.coverageStart||day>calendar.coverageEnd)throw Error('outside_pinned_calendar');
 const weekday=new Date(day+'T12:00:00Z').getUTCDay();
 return weekday!==0&&weekday!==6&&!(calendar.fullClosures as readonly string[]).includes(day);
}
export function pinnedSessionClose(day:string){
 if(!isPinnedSession(day))throw Error('not_a_session');
 const close=(calendar.earlyCloses as readonly string[]).includes(day)?'13':'16';
 for(let hour=17;hour<=21;hour++){
  const instant=`${day}T${hour}:00:00.000Z`;
  if(parts(new Date(instant)).hour===close)return instant;
 }
 throw Error('unresolved_session_close');
}
export type DailyPlan={policy:string;session:string;sessionClose:string;startedAt:string;expiresAt:string};
/** Explicit 2026 IEX scope. No extrapolated holiday calendar or historical replay. */
export function dailyCollectionPlan(now:Date):DailyPlan{
 if(!Number.isFinite(now.getTime())||now.getTime()<Date.parse(calendar.capturedAt))throw Error('invalid_or_historical_collection_clock');
 const today=parts(now).day;
 if(today<calendar.coverageStart||today>calendar.coverageEnd)throw Error('outside_pinned_calendar');
 for(let ago=0;ago<10;ago++){
  const day=new Date(Date.parse(today+'T12:00:00Z')-ago*86400000).toISOString().slice(0,10);
  if(!isPinnedSession(day))continue;
  const close=pinnedSessionClose(day);
  if(Date.parse(close)>now.getTime())continue;
  // Wait for daily finalization, but never substitute yesterday after today's close.
  if(now.getTime()-Date.parse(close)<15*60000)throw Error('daily_session_finalization_pending');
  let expires=now.getTime()+120000;
  if(isPinnedSession(today)&&Date.parse(pinnedSessionClose(today))>now.getTime())expires=Math.min(expires,Date.parse(pinnedSessionClose(today)));
  return {policy:DAILY_COLLECTION_POLICY,session:day,sessionClose:close,startedAt:now.toISOString(),expiresAt:new Date(expires).toISOString()};
 }
 throw Error('completed_session_unknown');
}
function checkPlan(plan:DailyPlan,now:Date){
 if(!Number.isFinite(now.getTime())||now.getTime()<Date.parse(plan.startedAt)||now.getTime()>=Date.parse(plan.expiresAt))throw Error('collection_clock_or_deadline');
 if(dailyCollectionPlan(now).session!==plan.session)throw Error('completed_session_changed');
}
export function dailySymbolEvidence(symbol:string,history:HistoryResult,plan:DailyPlan){
 const fail=(error:string)=>({evidence:[] as PersistableEvidence[],provenance:{symbol,error,source:history.source}});
 if(!(DAILY_SYMBOLS as readonly string[]).includes(symbol))throw Error('symbol_outside_scope');
 if(history.error)return fail(history.error);
 if(history.source!=='Alpaca:iex')return fail('unsupported_daily_feed');
 if(!validateDailyHistory(history.bars)||history.bars.length>1000||history.bars.length===0)return fail('invalid_or_empty_history');
 const bars=[...history.bars].sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
 const dates=new Set<string>();
 for(const bar of bars){
  const instant=evidenceTimestamp(bar.timestamp),local=parts(new Date(bar.timestamp));
  // Daily labels must be exact New York midnight, not intraday or close prices relabeled as daily bars.
  if(instant===null||instant%BigInt(1000000000)!==BigInt(0)||local.hour!=='00'||local.minute!=='00'||local.second!=='00'||
   local.day>plan.session||Date.parse(bar.timestamp)<Date.parse(plan.startedAt)-800*86400000||dates.has(local.day))return fail('invalid_daily_bar_label');
  if(local.day>=calendar.coverageStart&&!isPinnedSession(local.day))return fail('non_session_bar');
  dates.add(local.day);
 }
 if(parts(new Date(bars.at(-1)!.timestamp)).day!==plan.session)return fail('latest_completed_session_missing');
 // Require a complete trailing 200-session window (or all supplied recent sessions
 // for shorter inputs). Missing sessions cannot silently become N-session indicators.
 const first=parts(new Date(bars[0].timestamp)).day;
 let checked=0;
 for(let day=plan.session;day>=calendar.coverageStart&&day>=first&&checked<200;day=new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10)){
  if(isPinnedSession(day)){checked++;if(!dates.has(day))return fail('daily_session_gap');}
 }
 if(bars.length>=200&&checked<200)return fail('insufficient_pinned_calendar_for_200_sessions');
 const inputBars=bars.slice(-200);
 const digest=createHash('sha256').update(JSON.stringify(inputBars)).digest('hex');
 const calculated=calculateMarketFactors(inputBars),evidence:PersistableEvidence[]=[];
 const missing:Record<string,string>={};
 for(const factor of DAILY_KEYS){
  const item=calculated[factor];
  if(item?.value==null||!Number.isFinite(item.value)){missing[factor]=item?.reason??'unavailable';continue;}
  evidence.push({factor,value:item.value,domain:'stock',source:history.source,subject:symbol,
   observedAt:bars.at(-1)!.timestamp,availableAt:plan.startedAt,metadata:{collectionPolicy:plan.policy,expectedSession:plan.session,
    sessionClose:plan.sessionClose,providerBarTimestamp:bars.at(-1)!.timestamp,inputSha256:digest,inputCount:item.inputCount,
    inputReference:`completion.details.histories.${symbol}.bars`,calculationVersion:'market-factor-engine@73fd8f084de0615086a11b6c103ba6cc2c2da443',
    calendarTranscription:calendar.transcription,scientificallyCertified:false,executionAllowed:false}});
 }
 return {evidence,provenance:{symbol,source:history.source,bars:inputBars,inputSha256:digest,missing}};
}
export type DailyResult={evidence:PersistableEvidence[];details:Record<string,unknown>};
export type DailyDependencies={clock:()=>Date;claim:(plan:DailyPlan)=>Promise<boolean>;
 history:(symbol:string,asOf:string,completedSession:string)=>Promise<HistoryResult>;
 finish:(plan:DailyPlan,result:DailyResult)=>Promise<number>};
/** Library entry only: no route, schedule, DB credentials, automatic retry or production invocation. */
export async function runDailyFactorCollection(deps:DailyDependencies){
 const plan=dailyCollectionPlan(deps.clock());
 if(!await deps.claim(plan))return {status:'already_attempted',saved:0};
 let lastClock=Date.parse(plan.startedAt);
 const clock=()=>{const now=deps.clock();checkPlan(plan,now);if(now.getTime()<lastClock)throw Error('clock_regressed');lastClock=now.getTime();return now;};
 const evidence:PersistableEvidence[]=[],histories:Record<string,unknown>={};
 for(let i=0;i<DAILY_SYMBOLS.length;i+=2){
  clock();
  await Promise.all(DAILY_SYMBOLS.slice(i,i+2).map(async symbol=>{
   let history:HistoryResult;
   try{history=await deps.history(symbol,plan.startedAt,plan.session);}catch{history={bars:[],source:'Alpaca:iex',error:'fetch_failed'};}
   const received=clock();const result=dailySymbolEvidence(symbol,history,plan);
   histories[symbol]={...result.provenance,retrievedAt:received.toISOString()};evidence.push(...result.evidence);
  }));
 }
 const finishedAt=clock().toISOString();
 for(const row of evidence){row.availableAt=finishedAt;if(!validateEvidence(row,new Date(finishedAt)).accepted)throw Error('invalid_generated_evidence');}
 if(evidence.length>72)throw Error('row_limit');
 const result={evidence,details:{policy:plan.policy,session:plan.session,sessionClose:plan.sessionClose,startedAt:plan.startedAt,finishedAt,
  histories,executionAllowed:false,scientificallyCertified:false}};
 const saved=await deps.finish(plan,result);
 return {status:'observed_not_certified',candidates:evidence.length,saved,session:plan.session};
}
