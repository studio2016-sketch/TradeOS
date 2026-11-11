/** Descriptive only: never an execution, entitlement, or certification gate. */
export function quoteDiagnostics(s: {timestamp?:string;quoteTimestamp?:string;bid?:number;ask?:number;source?:string;coverage?:string}|undefined, now:number){
 const age=(raw:string|undefined)=>{const t=Date.parse(raw??"");return Number.isFinite(now)&&Number.isFinite(t)&&now>=t?now-t:null;};
 const bid=s?.bid,ask=s?.ask;
 const valid=typeof bid==="number"&&typeof ask==="number"&&Number.isFinite(bid)&&Number.isFinite(ask)&&bid>0&&ask>=bid;
 const midpoint=valid?bid!/2+ask!/2:null;
 const spreadBps=valid&&midpoint!==null?((ask!-bid!)/midpoint)*10000:null;
 return {priceAgeMs:age(s?.timestamp),quoteAgeMs:age(s?.quoteTimestamp),spreadBps:spreadBps!==null&&Number.isFinite(spreadBps)?spreadBps:null,source:s?.source||null,coverage:s?.coverage||null};
}
