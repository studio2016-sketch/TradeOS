import type {Bar} from "./features";
/** Prevent a recorded OHLC candle from leaking future prices into a replay. */
export function knownAtCutoff(bars:Bar[],asOfMs:number,barMinutes=5){
 if(!Number.isFinite(asOfMs)||barMinutes<=0)throw new Error("Invalid replay cutoff");
 const closedBy=asOfMs-barMinutes*60000;
 return bars.filter(b=>Number.isFinite(Date.parse(b.t))&&Date.parse(b.t)<=closedBy&&Number.isFinite(b.c)&&b.c>0).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
}
