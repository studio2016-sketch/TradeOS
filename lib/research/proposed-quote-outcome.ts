import {createHash} from 'node:crypto';

/** Unactivated proposal. Never call this an implementation of the active v3 protocol. */
export const PROPOSED_QUOTE_OUTCOME_POLICY={
 id:'tradeos.quote-outcome.proposal.v1',
 entry:'explicitly frozen source observation, received by forecast, quote age at most five minutes',
 endpoint:'after receipt grace closes, first same-source quote at or after horizon; quote and receipt within fifteen-minute grace',
 price:'finite positive bid/ask midpoint; locked markets accepted, crossed markets rejected',
 conflicts:'different prices for the same source quote timestamp fail closed',
 tie:'equal quotes ordered by receipt time then lexical stable observation ID',
 cost:'full entry spread divided by entry midpoint',
 certification:false
} as const;
export const PROPOSED_QUOTE_OUTCOME_FINGERPRINT=createHash('sha256').update(JSON.stringify(PROPOSED_QUOTE_OUTCOME_POLICY)).digest('hex');
export type FrozenQuote={id:string;symbol:string;sourceId:string;quoteAt:string;receivedAt:string;bid:number;ask:number};
type Quote=FrozenQuote&{time:number;receipt:number;midpoint:number};
export type ProposedQuoteOutcomeInput={forecastAt:string;horizonMs:number;asOf:string;frozenStart:FrozenQuote;candidates:FrozenQuote[];candidateSetComplete:boolean};

function quote(raw:FrozenQuote):Quote|null{
 if(!raw||typeof raw.id!=='string'||!raw.id.trim()||typeof raw.symbol!=='string'||!raw.symbol.trim()||typeof raw.sourceId!=='string'||!raw.sourceId.trim())return null;
 const time=typeof raw.quoteAt==='string'?Date.parse(raw.quoteAt):NaN,receipt=typeof raw.receivedAt==='string'?Date.parse(raw.receivedAt):NaN;
 if(!Number.isFinite(time)||!Number.isFinite(receipt)||time>receipt||!Number.isFinite(raw.bid)||!Number.isFinite(raw.ask)||raw.bid<=0||raw.ask<raw.bid)return null;
 const midpoint=raw.bid/2+raw.ask/2;
 if(!Number.isFinite(midpoint)||midpoint<=0)return null;
 return {...raw,time,receipt,midpoint};
}
function snapshot(q:Quote):FrozenQuote{return{id:q.id,symbol:q.symbol,sourceId:q.sourceId,quoteAt:q.quoteAt,receivedAt:q.receivedAt,bid:q.bid,ask:q.ask};}

/** Pure dry-run only: no database, provider, clock, forecast creation or certificate side effects. */
export function proposeQuoteOutcome(input:ProposedQuoteOutcomeInput){
 const common={method:PROPOSED_QUOTE_OUTCOME_POLICY.id,methodFingerprint:PROPOSED_QUOTE_OUTCOME_FINGERPRINT,activated:false,sourceTimeCertified:false,independentlyCertified:false,eligibleForLive:false} as const;
 const reject=(reason:string)=>({...common,status:'UNVERIFIED' as const,reason});
 const forecast=Date.parse(input.forecastAt),now=Date.parse(input.asOf);
 if(!Number.isFinite(forecast)||!Number.isFinite(now)||now<forecast||!Number.isSafeInteger(input.horizonMs)||input.horizonMs<=0)return reject('INVALID_FORECAST_WINDOW');
 const horizon=forecast+input.horizonMs,deadline=horizon+15*60_000;
 if(!Number.isSafeInteger(deadline))return reject('INVALID_FORECAST_WINDOW');
 const start=quote(input.frozenStart);
 if(!start||start.time>forecast||start.time<forecast-5*60_000||start.receipt>forecast)return reject('INVALID_FROZEN_ENTRY');
 if(!input.candidateSetComplete)return reject('INCOMPLETE_CANDIDATE_SET');
 const sameSource=input.candidates.filter(q=>q?.sourceId===start.sourceId&&q?.symbol===start.symbol);
 if(sameSource.some(q=>typeof q.receivedAt!=='string'||!Number.isFinite(Date.parse(q.receivedAt))))return reject('INVALID_RECEIPT_TIME');
 const known=sameSource.filter(q=>Date.parse(q.receivedAt)<=Math.min(now,deadline));
 const parsed=known.map(quote);
 if(parsed.some(q=>!q))return reject('INVALID_SAME_SOURCE_QUOTE');
 const rows=parsed as Quote[];
 // Unknown duplicate revisions are not silently selected using hindsight.
 const ids=new Map<string,Quote>(),times=new Map<number,Quote>();
 for(const q of [start,...rows]){
  const oldId=ids.get(q.id),oldTime=times.get(q.time);
  if(oldId&&(oldId.time!==q.time||oldId.receipt!==q.receipt||oldId.bid!==q.bid||oldId.ask!==q.ask))return reject('CONFLICTING_OBSERVATION_ID');
  if(oldTime&&(oldTime.bid!==q.bid||oldTime.ask!==q.ask))return reject('CONFLICTING_QUOTE_TIMESTAMP');
  ids.set(q.id,q);times.set(q.time,q);
 }
 if(now<=deadline)return {...common,status:'PENDING' as const,reason:'RECEIPT_WINDOW_NOT_FINAL'};
 const eligible=[...ids.values()].filter(q=>q.time>=horizon&&q.time<=deadline&&q.receipt<=deadline&&q.receipt<=now)
  .sort((a,b)=>a.time-b.time||a.receipt-b.receipt||(a.id<b.id?-1:a.id>b.id?1:0));
 if(!eligible.length)return {...common,status:now<=deadline?'PENDING' as const:'VOID' as const,reason:'NO_ELIGIBLE_SAME_SOURCE_ENDPOINT'};
 const end=eligible[0],realizedReturn=(end.midpoint-start.midpoint)/start.midpoint,quotedRoundTripCost=(start.ask-start.bid)/start.midpoint;
 if(!Number.isFinite(realizedReturn)||!Number.isFinite(quotedRoundTripCost))return reject('NONFINITE_CALCULATION');
 return {...common,status:'REPRODUCIBLE_PROPOSAL' as const,forecastAt:input.forecastAt,horizonMs:input.horizonMs,asOf:input.asOf,start:snapshot(start),end:snapshot(end),realizedReturn,quotedRoundTripCost};
}
