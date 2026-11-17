import {evidenceTimestamp} from '../research/evidence-time';
export type SessionScope='readiness'|'advancement';
export type SessionClock={timestamp:string;isOpen:boolean;nextOpen:string;nextClose:string};
type Check='PASS'|'FAIL'|'UNAVAILABLE'|'NOT_RUN_MARKET_CLOSED';
export type SessionDeps={clock:()=>Promise<SessionClock|null>;brokerConfigured:()=>Promise<boolean>;market:()=>Promise<unknown>;chart:()=>Promise<unknown>;now:()=>number;wait:(ms:number)=>Promise<void>};
const obj=(v:unknown):v is Record<string,any>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const ns=(ms:number)=>Number.isSafeInteger(ms)?BigInt(ms)*BigInt(1000000):null;
function freshClock(clock:SessionClock|null,now:number){
 const stamp=evidenceTimestamp(clock?.timestamp),end=ns(now);
 return Boolean(clock&&typeof clock.isOpen==='boolean'&&stamp!==null&&end!==null&&stamp<=end&&end-stamp<=BigInt(120000000000)&&evidenceTimestamp(clock.nextOpen)!==null&&evidenceTimestamp(clock.nextClose)!==null);
}
function sessionConsistent(clock:SessionClock,now:number){const boundary=evidenceTimestamp(clock.isOpen?clock.nextClose:clock.nextOpen),at=ns(now);return boundary!==null&&at!==null&&boundary>at;}
function snapshot(value:unknown,symbol:string){
 if(!obj(value)||!Array.isArray(value.snapshots))return null;
 const found=value.snapshots.filter((x:unknown)=>obj(x)&&x.symbol===symbol);
 return found.length===1&&obj(found[0])?found[0]:null;
}
export function advancementCheck(first:unknown,second:unknown,symbol:string,firstNow:number,secondNow:number):Check{
 const a=snapshot(first,symbol),b=snapshot(second,symbol);if(!a||!b)return 'UNAVAILABLE';
 const at=evidenceTimestamp(a.timestamp),bt=evidenceTimestamp(b.timestamp),start=ns(firstNow),end=ns(secondNow);
 if(at===null||bt===null||start===null||end===null)return 'UNAVAILABLE';
 if(typeof a.source!=='string'||!a.source||a.source!==b.source)return 'FAIL';
 if(typeof a.price!=='number'||!Number.isFinite(a.price)||a.price<=0||typeof b.price!=='number'||!Number.isFinite(b.price)||b.price<=0)return 'UNAVAILABLE';
 return secondNow-firstNow>=90000&&at<=start&&start-at<=BigInt(180000000000)&&bt>at&&bt<=end&&end-bt<=BigInt(180000000000)?'PASS':'FAIL';
}
export function unavailableSession(scope:SessionScope){
 const names=scope==='readiness'?['officialClockFresh','closedMarketNextOpenFuture','brokerReadConfigurationObserved','brokerAccountReadConfigured']:['officialSessionOpen','observationIntervalElapsed','spyObservationAdvanced','qqqObservationAdvanced','historicalChartPresent'];
 return {version:1,scope,checks:Object.fromEntries(names.map(x=>[x,'UNAVAILABLE' as Check])),assurance:'OBSERVATION_CHECK_ONLY_NOT_FEED_OR_MODEL_CERTIFICATION'} as const;
}
export async function runSessionAudit(scope:SessionScope,deps:SessionDeps,timeoutMs=155000){
 const fallback=unavailableSession(scope);let timer:ReturnType<typeof setTimeout>|undefined;let expired=false;
 try{return await Promise.race([
  (async()=>{
   const clock=await deps.clock(),now=deps.now();if(expired||!freshClock(clock,now))return fallback;
   if(scope==='readiness'){
    const next=evidenceTimestamp(clock!.nextOpen),current=ns(now),configured=await deps.brokerConfigured();if(expired)return fallback;
    return {...fallback,checks:{officialClockFresh:'PASS' as Check,closedMarketNextOpenFuture:(clock!.isOpen||next!==null&&current!==null&&next>current?'PASS':'FAIL') as Check,brokerReadConfigurationObserved:(typeof configured==='boolean'?'PASS':'FAIL') as Check,brokerAccountReadConfigured:(configured===true?'PASS':'UNAVAILABLE') as Check}};
   }
   if(!sessionConsistent(clock!,now))return fallback;
   if(!clock!.isOpen)return {...fallback,checks:Object.fromEntries(Object.keys(fallback.checks).map(x=>[x,'NOT_RUN_MARKET_CLOSED' as Check]))};
   const first=await deps.market(),firstNow=deps.now();if(expired||!sessionConsistent(clock!,firstNow))return fallback;
   await deps.wait(90000);if(expired)return fallback;
   const secondClock=await deps.clock();if(expired||!freshClock(secondClock,deps.now()))return fallback;
   if(!sessionConsistent(secondClock!,deps.now()))return fallback;
   if(!secondClock!.isOpen)return {...fallback,checks:Object.fromEntries(Object.keys(fallback.checks).map(x=>[x,'NOT_RUN_MARKET_CLOSED' as Check]))};
   const second=await deps.market(),secondNow=deps.now();if(expired||!sessionConsistent(secondClock!,secondNow))return fallback;
   const chart=await deps.chart();if(expired)return fallback;
   return {...fallback,checks:{officialSessionOpen:'PASS' as Check,observationIntervalElapsed:(secondNow-firstNow>=90000?'PASS':'FAIL') as Check,spyObservationAdvanced:advancementCheck(first,second,'SPY',firstNow,secondNow),qqqObservationAdvanced:advancementCheck(first,second,'QQQ',firstNow,secondNow),historicalChartPresent:(obj(chart)&&chart.symbol==='SPY'&&Array.isArray(chart.points)&&chart.points.length>0&&chart.points.every((p:unknown)=>obj(p)&&evidenceTimestamp(p.t)!==null&&typeof p.c==='number'&&Number.isFinite(p.c)&&p.c>0)&&typeof chart.source==='string'&&chart.source?'PASS':'UNAVAILABLE') as Check}};
  })(),
  new Promise<typeof fallback>(resolve=>{timer=setTimeout(()=>{expired=true;resolve(fallback);},timeoutMs);})
 ]);}catch{return fallback;}finally{if(timer)clearTimeout(timer);}
}
