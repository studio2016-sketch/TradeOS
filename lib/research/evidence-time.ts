/** Exact timestamp parsing for evidence boundaries. No local-time/date-only inference. */
export function evidenceTimestamp(value:unknown):bigint|null {
 if(typeof value!=='string')return null;
 const m=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2})(?::?(\d{2}))?)$/.exec(value);
 if(!m)return null;
 const [y,mo,d,h,mi,s]=m.slice(1,7).map(Number);
 const date=new Date(Date.UTC(y,mo-1,d,h,mi,s));
 if(y<1000||date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d||h>23||mi>59||s>59)return null;
 const offsetHours=Number(m[10]??0),offsetMinutes=Number(m[11]??0);
 if(offsetHours>23||offsetMinutes>59)return null;
 const offsetSeconds=(offsetHours*60+offsetMinutes)*60*(m[9]==='-'?-1:1);
 return BigInt(date.getTime())*BigInt(1000000)-BigInt(offsetSeconds)*BigInt(1000000000)+BigInt((m[7]??'').padEnd(9,'0'));
}
