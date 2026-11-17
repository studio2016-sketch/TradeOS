/** Fail-closed owner authorization shared by private pages and read APIs. */
export type PrivateReadStatus=200|401|403|503;
export type PrivateReadDependencies={session:()=>Promise<unknown>;ownerId:()=>string|undefined;account:(id:string)=>Promise<unknown>};
export async function privateReadStatus(deps:PrivateReadDependencies,timeoutMs=5000):Promise<PrivateReadStatus>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race<PrivateReadStatus>([
   (async()=>{
    const session=await deps.session() as {data?:{user?:{id?:unknown}};error?:unknown};
    if(session?.error)return 503;
    const id=session?.data?.user?.id;
    if(typeof id!=='string'||!id)return 401;
    const owner=deps.ownerId();
    if(!owner)return 503;
    if(id!==owner)return 403;
    const account=await deps.account(id) as {id?:unknown;role?:unknown;verified?:unknown;banned?:unknown}|undefined;
    return account?.id===id&&account.role==='admin'&&account.verified===true&&(account.banned===false||account.banned===null)?200:403;
   })(),
   new Promise<PrivateReadStatus>(resolve=>{timer=setTimeout(()=>resolve(503),timeoutMs);})
  ]);
 }catch{return 503;}finally{if(timer)clearTimeout(timer);}
}
export async function currentPrivateReadStatus():Promise<PrivateReadStatus>{
 try{const {headers}=await import('next/headers');if(!(await headers()).get('cookie'))return 401;}catch{return 503;}
 return privateReadStatus({
  session:async()=>{const {auth}=await import('./server');return auth.getSession();},
  ownerId:()=>process.env.TRADEOS_OWNER_USER_ID,
  account:async(id)=>{const {db}=await import('../db');const rows=await db()`select id::text,role,"emailVerified" as verified,banned from neon_auth."user" where id::text=${id} limit 1`;return rows[0];}
 });
}
/** Never invoke the private handler until authorization succeeds; no token bypass. */
export function withPrivateRead<A extends unknown[]>(handler:(...args:A)=>Promise<Response>,authorize:()=>Promise<PrivateReadStatus>=currentPrivateReadStatus){
 return async(...args:A):Promise<Response>=>{
  let status:PrivateReadStatus;
  try{status=await authorize();}catch{status=503;}
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
  if(status!==200)return Response.json({error:status===401?'sign_in_required':status===403?'owner_access_required':'authorization_unavailable'},{status,headers});
  const response=await handler(...args);
  // Override every success/error data response to prohibit shared caching.
  response.headers.set('Cache-Control','private, no-store');
  const vary=response.headers.get('Vary');response.headers.set('Vary',vary?`${vary}, Cookie`:'Cookie');
  return response;
 };
}
