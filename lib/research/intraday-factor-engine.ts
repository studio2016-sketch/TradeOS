export type IntradayBar={t:string;c:number;n?:number;v?:number};

export function returnAtMinutes(bars:IntradayBar[],minutes:number){
 if(!Number.isFinite(minutes)||minutes<=0||bars.length<2)return null;
 const ordered=[...bars].filter(b=>Number.isFinite(Date.parse(b.t))&&Number.isFinite(b.c)&&b.c>0).sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 if(ordered.length<2)return null;
 const last=ordered[ordered.length-1],lastTime=Date.parse(last.t),target=lastTime-minutes*60_000;
 let prior:IntradayBar|null=null;
 for(const bar of ordered){const time=Date.parse(bar.t);if(time<=target)prior=bar;else break;}
 if(!prior||prior.c<=0)return null;
 const gap=Math.abs(Date.parse(prior.t)-target);
 const tolerance=minutes<=1?90_000:minutes<=15?3*60_000:6*60_000;
 if(gap>tolerance)return null;
 return {value:last.c/prior.c-1,observedAt:last.t,priorAt:prior.t};
}

export function sessionTradeCount(bars:IntradayBar[]){
 if(!bars.length)return null;
 const observed=bars.filter(bar=>Number.isFinite(bar.n));
 if(observed.length/bars.length<.9)return null;
 const value=observed.reduce((sum,bar)=>sum+Number(bar.n),0);
 return Number.isFinite(value)&&value>=0?value:null;
}

export function turnoverFromVolumeShares(volume:number,shares:number){
 return Number.isFinite(volume)&&volume>=0&&Number.isFinite(shares)&&shares>0?volume/shares:null;
}

/** Research-only half quoted spread in basis points; not realized slippage. */
export function halfSpreadSlippageBps(bid:number,ask:number){
 if(!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<bid)return null;
 const mid=(bid+ask)/2;
 return mid>0?((ask-bid)/2)/mid*10_000:null;
}
