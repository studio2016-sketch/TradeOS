import {validateDailyHistory} from './daily-history-validation';
import type {HistoryResult} from './market-factor-history';
import {alpacaDailyHistory} from "./market-factor-history";
import {massiveDailyHistory} from "./massive-daily-history";
export async function independentHistoryComparison(symbol:string,asOf:string){
 const [a,m]=await Promise.all([alpacaDailyHistory(symbol,asOf),massiveDailyHistory(symbol,asOf)]);
 return compareIndependentHistories(symbol,asOf,a,m);
}

/** Errors or contradictory rows invalidate a whole source, not just the offending pair. */
export function compareIndependentHistories(symbol:string,asOf:string,alpaca:HistoryResult,massive:HistoryResult){
 const valid=(x:HistoryResult)=>!x.error&&validateDailyHistory(x.bars);
 const a=valid(alpaca)?alpaca:{...alpaca,bars:[],error:alpaca.error||"invalid_history"};
 const m=valid(massive)?massive:{...massive,bars:[],error:massive.error||"invalid_history"};
 const map=new Map(a.bars.map(b=>[new Date(b.timestamp).toISOString().slice(0,10),b]));
 const pairs=m.bars.flatMap(b=>{const other=map.get(new Date(b.timestamp).toISOString().slice(0,10));return other?[{date:new Date(b.timestamp).toISOString().slice(0,10),massiveClose:b.close,alpacaClose:other.close,differenceBps:10000*Math.abs(b.close-other.close)/b.close}]:[]});
 pairs.sort((a,b)=>a.date.localeCompare(b.date));
 const agreeing=pairs.filter(p=>p.differenceBps<=100);
 return {symbol,asOf,primary:m.source,secondary:a.source,massiveBars:m.bars.length,alpacaBars:a.bars.length,overlap:pairs.length,agreeing:agreeing.length,agreementRatio:pairs.length?agreeing.length/pairs.length:null,minimumComparableSessions:20,comparabilityEstablished:pairs.length>=20,volumeComparisonEligible:false,volumeCaution:"IEX-only volume and consolidated market volume do not have comparable coverage.",pairedCloses:pairs.slice(-250),discrepant:pairs.filter(p=>p.differenceBps>100).slice(0,10),errors:{massive:m.error??null,alpaca:a.error??null},sourceTimeCertified:false,notice:"Independent price agreement is not evidence that either source was available at a historical decision time."};
}
