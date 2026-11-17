import type {AuditDenial} from './runtime-audit-oidc';
/** Bounded per-instance logging: never accept caller values or log raw errors/claims. */
export function createAuditDenialReporter(emit:(label:string,reason:AuditDenial)=>void=console.warn,now:()=>number=Date.now){
 const last=new Map<AuditDenial,number>();
 return (reason:AuditDenial)=>{
  const time=now(),previous=last.get(reason);
  if(previous!==undefined&&time-previous<60000)return;
  last.set(reason,time);emit('TRADEOS_AUDIT_AUTH_DENIED',reason);
 };
}
export const reportAuditDenial=createAuditDenialReporter();
