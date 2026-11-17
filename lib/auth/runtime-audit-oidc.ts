import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
export const AUDIT_ISSUER='https://token.actions.githubusercontent.com';
export const AUDIT_AUDIENCE='https://tradeos-lac.vercel.app/private-audit';
const repo='studio2016-sketch/TradeOS', repoId='1409039268', ownerId='331044643';
const main='refs/heads/main';
const workflows:Record<string,string>={
 heartbeat:'private-runtime-audit.yml',sources:'extended-production-audit.yml',
 models:'model-runtime-audit.yml',graph:'knowledge-graph-production.yml',
 readiness:'broker-clock-readiness.yml',advancement:'market-hours-advance.yml',
};
const keys=createRemoteJWKSet(new URL(AUDIT_ISSUER+'/.well-known/jwks'),{
 timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000,
});
/** Scope derives exclusively from the three allowlisted endpoint paths and exact parameters. */
export function auditRequestScope(request:Request):string|null{
 const u=new URL(request.url);
 if(request.method!=='GET')return null;
 if(u.pathname==='/api/private-runtime-audit'&&!u.search)return 'heartbeat';
 if(u.searchParams.size!==1)return null;
 const s=u.searchParams.get('scope');
 if(u.pathname==='/api/private-detailed-audit'&&['sources','models','graph'].includes(s??''))return s;
 if(u.pathname==='/api/private-market-audit'&&['readiness','advancement'].includes(s??''))return s;
 return null;
}
/** Never returns claims, token values, provider errors or any owner-session authority. */
export type AuditDenial='token_shape'|'jwt_header'|'jwt_time'|'audience'|'identity'|'ref_or_runner'|'event'|'workflow'|'context_environment'|'context_reusable_ref_equal_sha_equal'|'context_reusable_ref_equal_sha_absent'|'context_reusable_ref_equal_sha_other'|'context_reusable_ref_empty'|'context_reusable_ref_other'|'context_reusable_sha'|'context_pr_ref'|'subject'|'sha'|'run'|'jwt_validation'|'jwt_key_fetch'|'jwt_signature'|'jwt_claim_time'|'jwt_claim_issuer'|'jwt_claim_audience'|'jwt_claim_other';
export async function authorizeOidcAudit(request:Request,key:JWTVerifyGetKey=keys,now=new Date(),report?:(reason:AuditDenial)=>void):Promise<200|401|403>{
 const deny=(reason:AuditDenial):403=>{try{report?.(reason);}catch{/* diagnostics must never change authorization */}return 403;};
 const scope=auditRequestScope(request),auth=request.headers.get('authorization');
 if(!auth)return 401;
 if(!scope||auth.length>16384||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth))return deny('token_shape');
 try{
  const {payload:p,protectedHeader:h}=await jwtVerify(auth.slice(7),key,{
   algorithms:['RS256'],issuer:AUDIT_ISSUER,audience:AUDIT_AUDIENCE,
   requiredClaims:['sub','iat','nbf','exp','jti'],maxTokenAge:300,clockTolerance:0,currentDate:now,
  });
  if(h.typ!=='JWT'||typeof h.kid!=='string'||!h.kid||h.jku!==undefined||h.jwk!==undefined||h.x5u!==undefined)return deny('jwt_header');
  const t=Math.floor(now.getTime()/1000);
  if(!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.nbf)||!Number.isSafeInteger(p.exp)||p.iat!>t||p.nbf!>t||p.exp!<=t||p.exp!-p.iat!>600||p.exp!<=p.iat!)return deny('jwt_time');
  if(p.aud!==AUDIT_AUDIENCE||typeof p.jti!=='string'||!p.jti)return deny('audience');
  if(p.repository!==repo||p.repository_id!==repoId||p.repository_owner!=='studio2016-sketch'||p.repository_owner_id!==ownerId)return deny('identity');
  if(p.ref!==main||p.ref_type!=='branch'||p.runner_environment!=='github-hosted')return deny('ref_or_runner');
  if(typeof p.event_name!=='string'||!['schedule','workflow_dispatch'].includes(p.event_name))return deny('event');
  if(p.workflow_ref!==`${repo}/.github/workflows/${workflows[scope]}@${main}`)return deny('workflow');
  // GitHub may include job claims for the same direct workflow. Accept only a
  // complete pair exactly matching the already allowlisted workflow and valid SHA.
  // Other reusable workflows, environment contexts and PR refs stay denied.
  if(p.environment!==undefined)return deny('context_environment');
  if(p.job_workflow_ref!==undefined||p.job_workflow_sha!==undefined){
   if(p.job_workflow_ref!==p.workflow_ref)return deny('context_reusable_ref_other');
   if(typeof p.workflow_sha!=='string'||! /^[a-f0-9]{40}$/.test(p.workflow_sha)||p.job_workflow_sha!==p.workflow_sha)return deny('context_reusable_ref_equal_sha_other');
  }
  if(p.head_ref||p.base_ref)return deny('context_pr_ref');
  const legacy=`repo:${repo}:ref:${main}`;
  const immutable=`repo:studio2016-sketch@${ownerId}/TradeOS@${repoId}:ref:${main}`;
  if(p.sub!==legacy&&p.sub!==immutable)return deny('subject');
  for(const field of ['sha','workflow_sha'])if(typeof p[field]!=='string'||! /^[a-f0-9]{40}$/.test(p[field] as string))return deny('sha');
  if(p.sha!==p.workflow_sha)return deny('sha');
  for(const field of ['run_id','run_attempt'])if(typeof p[field]!=='string'||! /^[1-9][0-9]*$/.test(p[field] as string))return deny('run');
  return 200;
 }catch(error){
  const e=error as {code?:unknown;claim?:unknown};
  if(e?.code==='ERR_JWS_SIGNATURE_VERIFICATION_FAILED')return deny('jwt_signature');
  if(e?.code==='ERR_JWKS_TIMEOUT'||e?.code==='ERR_JWKS_NO_MATCHING_KEY')return deny('jwt_key_fetch');
  if(e?.code==='ERR_JWT_EXPIRED')return deny('jwt_claim_time');
  if(e?.code==='ERR_JWT_CLAIM_VALIDATION_FAILED'){
   if(e.claim==='iss')return deny('jwt_claim_issuer');
   if(e.claim==='aud')return deny('jwt_claim_audience');
   if(e.claim==='iat'||e.claim==='nbf'||e.claim==='exp')return deny('jwt_claim_time');
   return deny('jwt_claim_other');
  }
  return deny('jwt_validation');
 }
}
