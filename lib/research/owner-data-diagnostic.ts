export type OwnerDiagnosticWindow=Readonly<{opensAt:string;expiresAt:string}>;
/** Pin a <=15-minute window in the separately reviewed release. No environment/request override. */
export const OWNER_DIAGNOSTIC_WINDOW:OwnerDiagnosticWindow|null=Object.freeze({opensAt:'2026-11-17T07:50:00Z',expiresAt:'2026-11-17T08:05:00Z'});
export function ownerDiagnosticRequest(req:Request,window:OwnerDiagnosticWindow|null,now:Date){
 if(req.method!=='POST'||new URL(req.url).origin!=='https://tradeos-lac.vercel.app'||
  req.headers.get('origin')!=='https://tradeos-lac.vercel.app'||req.headers.get('sec-fetch-site')!=='same-origin'||
  req.headers.get('x-tradeos-diagnostic')!=='owner-read-only-v1')return 403;
 if(new URL(req.url).search||req.body!==null)return 400;
 if(!window)return 409;
 const opens=Date.parse(window.opensAt),expires=Date.parse(window.expiresAt),time=+now;
 if(![opens,expires,time].every(Number.isFinite)||expires<=opens||expires-opens>15*60000||time<opens||time+60000>expires)return 409;
 return 200;
}
export async function verifiedDiagnosticOwner(id:unknown,expected:unknown,sql:any){
 if(typeof id!=='string'||!id||typeof expected!=='string'||!expected||id!==expected)return false;
 const rows=await sql`select role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
 return rows.length===1&&rows[0]?.role==='admin'&&rows[0]?.banned!==true&&rows[0]?.verified===true;
}

/** Bound external session verification; late completion cannot start diagnostic work. */
export async function boundedOwnerSession<T>(read:()=>Promise<T>,timeoutMs=5000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('session_timeout')),timeoutMs);})]);}
 finally{if(timer)clearTimeout(timer);}
}
