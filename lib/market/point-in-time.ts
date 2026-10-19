import {db} from "../db";

/** Point-in-time replay requires BOTH observed event time and availability time. */
export async function observationsAvailableAt(symbol:string, instant:string) {
 if(!/^[A-Z0-9.-]{1,10}$/.test(symbol)) throw new Error("Invalid symbol");
 const at=new Date(instant);
 if(!Number.isFinite(at.getTime())) throw new Error("Invalid as-of time");
 const sql=db();
 return sql`
  select observation_id,security_id,symbol,source_family,source_product,
         event_time,available_at,raw_sha256,payload,validation_status
  from institutional_observations
  where symbol=${symbol}
    and event_time<=${at.toISOString()}::timestamptz
    and available_at<=${at.toISOString()}::timestamptz
    and validation_status='verified'
  order by event_time desc, available_at desc
  limit 1000
 `;
}
