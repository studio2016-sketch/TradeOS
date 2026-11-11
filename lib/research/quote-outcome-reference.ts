/** Separately implemented nanosecond reference. No production selector/parser imports.
 * Agreement is an implementation cross-check, never source or scientific certification. */
import type {FrozenQuote,ProposedQuoteOutcomeInput} from './proposed-quote-outcome';
const million=BigInt(1000000),billion=BigInt(1000000000);
function instant(value:string):bigint|null {
 if(typeof value!=='string')return null;
 const match=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2})(?::?(\d{2}))?)$/.exec(value);
 if(!match)return null;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]);
 const date=new Date(Date.UTC(year,month-1,day,hour,minute,second));
 if(year<1000||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||hour>23||minute>59||second>59)return null;
 const oh=Number(match[10]??0),om=Number(match[11]??0);
 if(oh>23||om>59)return null;
 const offset=(oh*60+om)*60*(match[9]==='-'?-1:1);
 return BigInt(date.getTime())*million-BigInt(offset)*billion+BigInt((match[7]??'').padEnd(9,'0'));
}
type ReferenceQuote={raw:FrozenQuote;at:bigint;received:bigint;mid:number};
function parse(raw:FrozenQuote):ReferenceQuote|null {
 if(!raw||typeof raw.id!=='string'||!raw.id.trim()||typeof raw.sourceId!=='string'||!raw.sourceId.trim()||typeof raw.symbol!=='string'||!raw.symbol.trim())return null;
 const at=instant(raw.quoteAt),received=instant(raw.receivedAt);
 if(at===null||received===null||at>received||!Number.isFinite(raw.bid)||!Number.isFinite(raw.ask)||raw.bid<=0||raw.ask<raw.bid)return null;
 return {raw,at,received,mid:raw.bid+(raw.ask-raw.bid)/2};
}
export function referenceQuoteOutcome(input:ProposedQuoteOutcomeInput){
 const invalid=(reason:string)=>({status:'UNVERIFIED' as const,reason});
 const forecast=instant(input.forecastAt),asOf=instant(input.asOf);
 if(forecast===null||asOf===null||asOf<forecast||!Number.isSafeInteger(input.horizonMs)||input.horizonMs<=0)return invalid('INVALID_WINDOW');
 const horizon=forecast+BigInt(input.horizonMs)*million,deadline=horizon+BigInt(900000)*million;
 const entry=parse(input.frozenStart);
 if(!entry||entry.at>forecast||entry.at<forecast-BigInt(300000)*million||entry.received>forecast)return invalid('INVALID_ENTRY');
 if(input.candidateSetComplete!==true)return invalid('INCOMPLETE_RETRIEVAL');
 const known:ReferenceQuote[]=[entry];
 for(const raw of input.candidates){
  if(raw.sourceId!==entry.raw.sourceId||raw.symbol!==entry.raw.symbol)continue;
  const receipt=instant(raw.receivedAt);
  if(receipt===null)return invalid('INVALID_RECEIPT');
  if(receipt>asOf||receipt>deadline)continue;
  const q=parse(raw);if(!q)return invalid('INVALID_QUOTE');
  known.push(q);
 }
 // Two independent sorted passes catch ID revisions and quote-time conflicts.
 const byId=[...known].sort((a,b)=>a.raw.id<b.raw.id?-1:a.raw.id>b.raw.id?1:0);
 for(let i=1;i<byId.length;i++){
  const a=byId[i],b=byId[i-1];
  if(a.raw.id===b.raw.id&&(a.at!==b.at||a.received!==b.received||a.raw.bid!==b.raw.bid||a.raw.ask!==b.raw.ask))return invalid('CONFLICTING_ID');
 }
 const byTime=[...known].sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:0);
 for(let i=1;i<byTime.length;i++){
  const a=byTime[i],b=byTime[i-1];
  if(a.at===b.at&&(a.raw.bid!==b.raw.bid||a.raw.ask!==b.raw.ask))return invalid('CONFLICTING_QUOTE');
 }
 if(asOf<=deadline)return {status:'PENDING' as const};
 let selected:ReferenceQuote|null=null;
 for(const q of known){
  if(q.at<horizon||q.at>deadline||q.received>deadline)continue;
  if(!selected||q.at<selected.at||(q.at===selected.at&&(q.received<selected.received||(q.received===selected.received&&q.raw.id<selected.raw.id))))selected=q;
 }
 if(!selected)return {status:'VOID' as const};
 const realizedReturn=selected.mid/entry.mid-1,quotedRoundTripCost=(entry.raw.ask-entry.raw.bid)/entry.mid;
 if(!Number.isFinite(realizedReturn)||!Number.isFinite(quotedRoundTripCost))return invalid('NONFINITE_RESULT');
 return {status:'REPRODUCIBLE_PROPOSAL' as const,entryId:entry.raw.id,endpointId:selected.raw.id,realizedReturn,quotedRoundTripCost};
}
