import {alpacaDailyHistory} from "./market-factor-history";
import {massiveDailyHistory} from "./massive-daily-history";
export async function independentHistoryComparison(symbol:string,asOf:string){
 const [a,m]=await Promise.all([alpacaDailyHistory(symbol,asOf),massiveDailyHistory(symbol,asOf)]);
 const map=new Map(a.bars.map(b=>[b.timestamp.slice(0,10),b]));
 const pairs=m.bars.flatMap(b=>{const other=map.get(b.timestamp.slice(0,10));return other?[{date:b.timestamp.slice(0,10),massiveClose:b.close,alpacaClose:other.close,differenceBps:10000*Math.abs(b.close-other.close)/b.close}]:[]});
 const agreeing=pairs.filter(p=>p.differenceBps<=100);
 return {symbol,asOf,primary:m.source,secondary:a.source,massiveBars:m.bars.length,alpacaBars:a.bars.length,overlap:pairs.length,agreeing:agreeing.length,discrepant:pairs.filter(p=>p.differenceBps>100).slice(0,10),errors:{massive:m.error??null,alpaca:a.error??null},sourceTimeCertified:false,notice:"Independent price agreement is not evidence that either source was available at a historical decision time."};
}
