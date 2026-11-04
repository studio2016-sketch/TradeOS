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


/**
 * A board status must describe the snapshot actually shown, not a second fetch.
 * Missing/invalid prices cannot become recent from a timestamp alone.
 */
export function snapshotObservationState(snapshot:{price?:unknown;timestamp?:unknown}|null|undefined,now=Date.now()):"recent_observation"|"delayed_observation"|"stale"|"unverified"{
 if(!snapshot||typeof snapshot.price!=="number"||!Number.isFinite(snapshot.price)||snapshot.price<=0)return "unverified";
 const state=observationState(snapshot.timestamp,now);
 // Clock-skew tolerance does not make a future observation recent.
 return state==="unknown"?"unverified":Date.parse(String(snapshot.timestamp))>now?"delayed_observation":state;
}
