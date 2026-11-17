import {reportAuditDenial} from './audit-denial-diagnostics';
import {authorizeRuntimeAudit as authorizeStaticAudit} from './runtime-audit';
/** Explicit mode selection: OIDC errors can never fall back to a stored capability. */
export async function authorizeRuntimeAudit(request:Request):Promise<200|401|403|503>{
 const mode=process.env.TRADEOS_RUNTIME_AUDIT_AUTH_MODE;
 if(mode==='github-oidc'){
  if(process.env.VERCEL_ENV!=='production')return 503;
  const {authorizeOidcAudit}=await import('./runtime-audit-oidc');
  return authorizeOidcAudit(request,undefined,undefined,reportAuditDenial);
 }
 if(mode!==undefined&&mode!=='static')return 503;
 return authorizeStaticAudit(request);
}
