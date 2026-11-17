/** Narrow public-log-safe result; never serialize rows, exceptions, counts or account values. */
export type AuditDeps={probe:()=>Promise<unknown>;now:()=>number};
export async function runtimeAudit(deps:AuditDeps,timeoutMs=5000){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const now=deps.now();
  const value=await Promise.race([deps.probe(),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);})]);
  const row=value as {database_ok?:unknown;last_ingestion?:unknown;last_research?:unknown}|null;
  function recent(value:unknown,windowMs:number){
   if(typeof value!=='string'&&!(value instanceof Date))return false;
   const time=new Date(value).getTime();return Number.isFinite(now)&&Number.isFinite(time)&&time<=now&&now-time<=windowMs;
  }
  return {version:1,databaseReachable:row?.database_ok===1,ingestionObservedWithin12Minutes:recent(row?.last_ingestion,720000),researchObservedWithin40Minutes:recent(row?.last_research,2400000),scope:'CONNECTIVITY_AND_STORED_HEARTBEATS_ONLY',marketFreshnessCertified:false,modelValidated:false,ownerSessionVerified:false} as const;
 }catch{return {version:1,databaseReachable:false,ingestionObservedWithin12Minutes:false,researchObservedWithin40Minutes:false,scope:'CONNECTIVITY_AND_STORED_HEARTBEATS_ONLY',marketFreshnessCertified:false,modelValidated:false,ownerSessionVerified:false} as const;}
 finally{if(timer)clearTimeout(timer);}
}
