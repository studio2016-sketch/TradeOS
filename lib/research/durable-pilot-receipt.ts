import {replayDailyReceipt,DAILY_RECEIPT_REPLAY_VERSION} from './daily-receipt-replay';
import {DAILY_COLLECTION_POLICY} from './daily-factor-collection';
export type PilotReceipt = {
 status:'verified'|'unverified'|'claimed'|'none'|'unavailable'; checkedAt:string;
 session?:string; availableAt?:string; newlySaved?:number; verifiedIdentities?:number;
 symbols?:{symbol:string;factors:number;inputBars:number}[];
 verificationVersion?:string;
 ordersAllowed:false;certified:false;
};
const validSession=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
/** Reduce private durable records to a deliberately small owner-visible receipt.
 * No raw prices, bars, hashes, metadata, account data, errors or SQL leave this boundary.
 */
export function summarizePilotSnapshot(snapshot:any,checkedAt:string):PilotReceipt {
 const base={checkedAt,ordersAllowed:false as const,certified:false as const};
 if(snapshot===null)return {...base,status:'none'};
 if(!snapshot||!validSession(snapshot.session))return {...base,status:'unavailable'};
 const session=snapshot.session;
 if(!snapshot.completion)return snapshot.claim?{...base,session,status:'claimed'}:{...base,status:'unavailable'};
 const replay=replayDailyReceipt(snapshot);
 if(replay.status!=='PASS')return {...base,session,status:'unverified',verificationVersion:DAILY_RECEIPT_REPLAY_VERSION};
 return {...base,status:'verified',session:replay.session,availableAt:replay.availableAt,newlySaved:replay.newlySaved,
  verifiedIdentities:replay.verifiedIdentities,verificationVersion:replay.verificationVersion,
  symbols:replay.symbols.map(({symbol,factors,inputBars})=>({symbol,factors,inputBars}))};
}
/** Injected read-only SQL connection. One statement gives a consistent snapshot, not multiple reads.
 * Latest attempt is shown, including a claim without completion; absence does not permit a retry.
 */
export async function readPilotReceipt(sql:any,checkedAt:string):Promise<PilotReceipt>{
 try{
  const rows=await sql`with latest as (
   select session from (select session from public.tradeos_daily_factor_claims union select session from public.tradeos_daily_factor_completions) s
   order by session desc limit 1
  ) select jsonb_build_object(
   'session',l.session::text,
   'claim',case when c.session is null then null else jsonb_build_object('session',c.session::text,'policy',c.policy,
    'started_at',to_char(c.started_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expires_at',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) end,
   'completion',case when d.session is null then null else jsonb_build_object('session',d.session::text,'saved',d.saved,
    'details',case when octet_length(d.details::text)<=1500000 then d.details else null end) end,
   'evidence',coalesce((select jsonb_agg(e.row) from (
    select jsonb_build_object('factor_key',factor_key,'domain',domain,'subject',subject,'value',value,'source_name',source_name,
     'observed_at',to_char(observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
     'available_at',to_char(available_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
     'source_metadata',case when octet_length(source_metadata::text)<=8000 then source_metadata else null end) as row
    from public.tradeos_factor_evidence where source_metadata->>'expectedSession'=l.session::text
     and source_metadata->>'collectionPolicy'=${DAILY_COLLECTION_POLICY} limit 73
   ) e),'[]'::jsonb)
  ) snapshot from latest l left join public.tradeos_daily_factor_claims c on c.session=l.session
   left join public.tradeos_daily_factor_completions d on d.session=l.session`;
  if(!Array.isArray(rows)||rows.length>1)throw Error('invalid_snapshot');
  return summarizePilotSnapshot(rows.length===0?null:rows[0].snapshot,checkedAt);
 }catch{return {status:'unavailable',checkedAt,ordersAllowed:false,certified:false};}
}
/** Server-only caller must authorize before invoking. Read-only transaction plus bounded transport. */
export async function currentPilotReceipt():Promise<PilotReceipt>{
 const checkedAt=new Date().toISOString();
 try{
  const {db}=await import('../db');const {dailyRequestBudget}=await import('./daily-request-budget');
  const budget=dailyRequestBudget(()=>Date.now(),8000);
  return await budget.run(()=>readPilotReceipt(budget.sql(db(),true),checkedAt));
 }catch{return {status:'unavailable',checkedAt,ordersAllowed:false,certified:false};}
}
