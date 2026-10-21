export type SourceReading={provider:string;symbol:string;eventAt:string;receivedAt:string;value:number};
export function independentSourceTimeCheck(a:SourceReading,b:SourceReading,decisionAt:string){
 const d=Date.parse(decisionAt),at=Date.parse(a.eventAt),bt=Date.parse(b.eventAt),ar=Date.parse(a.receivedAt),br=Date.parse(b.receivedAt);
 const independent=a.provider.split(":")[0]!==b.provider.split(":")[0];
 const chronological=[d,at,bt,ar,br].every(Number.isFinite)&&at<=ar&&bt<=br&&ar<=d&&br<=d;
 const aligned=a.symbol===b.symbol&&Math.abs(at-bt)<=60000;
 const comparable=Number.isFinite(a.value)&&Number.isFinite(b.value)&&a.value>0&&b.value>0;
 const deviationBps=comparable?Math.abs(a.value-b.value)/b.value*10000:null;
 const passed=independent&&chronological&&aligned&&comparable&&deviationBps!==null&&deviationBps<=100;
 return {passed,independent,chronological,aligned,deviationBps,sourceTimeCertified:false,reason:passed?"price_consistency_only_not_historical_release_certification":"independence_time_or_price_check_failed"};
}
