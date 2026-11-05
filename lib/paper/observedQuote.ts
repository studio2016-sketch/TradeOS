import type {PaperQuote} from './simulator';
type SnapshotQuote={symbol:string;bid?:number;ask?:number;quoteTimestamp?:string;source:string};
/** Bid/ask recency must use their own timestamp, never a trade or candle time. */
export function observedPaperQuote(snapshot:SnapshotQuote|null|undefined,symbol:string,nowMs=Date.now()):{quote:PaperQuote;ageMs:number}|null{
 if(!snapshot||snapshot.symbol!==symbol||!snapshot.source||!Number.isFinite(nowMs))return null;
 const {bid,ask,quoteTimestamp}=snapshot;
 if(typeof bid!=='number'||typeof ask!=='number'||!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<bid)return null;
 if(!quoteTimestamp)return null;
 const observed=Date.parse(quoteTimestamp),ageMs=nowMs-observed;
 if(!Number.isFinite(observed)||ageMs<0||ageMs>60000)return null;
 return {quote:{symbol,bid,ask,observedAt:quoteTimestamp,source:snapshot.source},ageMs};
}
