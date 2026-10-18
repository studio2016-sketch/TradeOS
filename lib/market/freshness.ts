/**
 * Quote freshness is a market observation property, not a fetch timestamp.
 * This module never certifies exchange real-time permissions.
 */
export function observedAgeMs(timestamp:unknown,now=Date.now()):number|null{
 if(typeof timestamp!=="string")return null;
 const time=Date.parse(timestamp);
 if(!Number.isFinite(time)||time<=0||time>now+60000)return null;
 return Math.max(0,now-time);
}
export function observationState(timestamp:unknown,now=Date.now()):"recent_observation"|"delayed_observation"|"stale"|"unknown"{
 const age=observedAgeMs(timestamp,now);
 return age===null?"unknown":age<60000?"recent_observation":age<20*60000?"delayed_observation":"stale";
}
export function validHistoricalPoint(value:{t?:unknown;c?:unknown}|null):boolean{
 return Boolean(value&&typeof value.t==="string"&&Number.isFinite(Date.parse(value.t))&&typeof value.c==="number"&&Number.isFinite(value.c)&&value.c>0);
}
