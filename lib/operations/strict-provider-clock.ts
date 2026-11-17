import {evidenceTimestamp} from '../research/evidence-time';
import type {SessionClock} from './market-session-audit';
/** Never invent a provider timestamp or coerce a missing is_open value. */
export function strictClock(value:unknown):SessionClock|null{
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>;
 if(typeof v.is_open!=='boolean'||evidenceTimestamp(v.timestamp)===null||evidenceTimestamp(v.next_open)===null||evidenceTimestamp(v.next_close)===null)return null;
 return {timestamp:v.timestamp as string,isOpen:v.is_open,nextOpen:v.next_open as string,nextClose:v.next_close as string};
}
export async function readStrictProviderClock():Promise<SessionClock|null>{
 const key=process.env.ALPACA_API_KEY,secret=process.env.ALPACA_API_SECRET;if(!key||!secret)return null;
 const base=process.env.ALPACA_TRADING_ENV==='live'?'https://api.alpaca.markets':'https://paper-api.alpaca.markets';
 try{const r=await fetch(base+'/v2/clock',{headers:{'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});return r.ok?strictClock(await r.json()):null;}catch{return null;}
}
