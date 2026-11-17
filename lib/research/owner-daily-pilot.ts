import {privateReadStatus} from "../auth/private-read";
/** Authenticated browser CSRF boundary; request cannot supply the approval, session or universe. */
export function ownerDailyPilotRequest(req:Request){
 return req.method==='POST'&&new URL(req.url).origin==='https://tradeos-lac.vercel.app'&&!new URL(req.url).search&&
  req.headers.get('origin')==='https://tradeos-lac.vercel.app'&&req.headers.get('sec-fetch-site')==='same-origin'&&
  req.headers.get('x-tradeos-daily-pilot')==='owner-pilot-v1';
}

/** Reuse strict current-owner semantics with the request-bounded read-only SQL transport. */
export async function ownerDailyPilotStatus(session:()=>Promise<unknown>,ownerId:()=>string|undefined,sql:any){
 return privateReadStatus({
  session,ownerId,
  account:async(id)=>{const rows=await sql`select id::text,role,"emailVerified" as verified,banned from neon_auth."user" where id::text=${id} limit 1`;return rows[0];}
 });
}
