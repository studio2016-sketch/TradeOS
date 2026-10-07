export function horizonMs(horizon:string){
  const h=horizon.trim().toLowerCase();
  const m=h.match(/^([0-9]+)\s*(m|min|mins|minute|minutes)$/);
  if(m)return Number(m[1])*60_000;
  const hr=h.match(/^([0-9]+)\s*(h|hr|hrs|hour|hours)$/);
  if(hr)return Number(hr[1])*3_600_000;
  const d=h.match(/^([0-9]+)\s*(d|day|days)$/);
  if(d)return Number(d[1])*86_400_000;
  return null;
}
