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
export async function authorizeOidcAudit(request:Request,key:JWTVerifyGetKey=keys,now=new Date()):Promise<200|401|403>{
 const scope=auditRequestScope(request),auth=request.headers.get('authorization');
 if(!auth)return 401;
 if(!scope||auth.length>16384||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth))return 403;
 try{
  const {payload:p,protectedHeader:h}=await jwtVerify(auth.slice(7),key,{
   algorithms:['RS256'],issuer:AUDIT_ISSUER,audience:AUDIT_AUDIENCE,
   requiredClaims:['sub','iat','nbf','exp','jti'],maxTokenAge:300,clockTolerance:0,currentDate:now,
  });
  if(h.typ!=='JWT'||typeof h.kid!=='string'||!h.kid||h.jku!==undefined||h.jwk!==undefined||h.x5u!==undefined)return 403;
  const t=Math.floor(now.getTime()/1000);
  if(!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.nbf)||!Number.isSafeInteger(p.exp)||p.iat!>t||p.nbf!>t||p.exp!<=t||p.exp!-p.iat!>600||p.exp!<=p.iat!)return 403;
  if(p.aud!==AUDIT_AUDIENCE||typeof p.jti!=='string'||!p.jti)return 403;
  if(p.repository!==repo||p.repository_id!==repoId||p.repository_owner!=='studio2016-sketch'||p.repository_owner_id!==ownerId)return 403;
  if(p.ref!==main||p.ref_type!=='branch'||p.runner_environment!=='github-hosted')return 403;
  if(typeof p.event_name!=='string'||!['schedule','workflow_dispatch'].includes(p.event_name))return 403;
  if(p.workflow_ref!==`${repo}/.github/workflows/${workflows[scope]}@${main}`)return 403;
  // No reusable-workflow/environment/PR claim interpretation or wildcard subjects.
  if(p.environment!==undefined||p.job_workflow_ref!==undefined||p.job_workflow_sha!==undefined||p.head_ref||p.base_ref)return 403;
  const legacy=`repo:${repo}:ref:${main}`;
  const immutable=`repo:studio2016-sketch@${ownerId}/TradeOS@${repoId}:ref:${main}`;
  if(p.sub!==legacy&&p.sub!==immutable)return 403;
  for(const field of ['sha','workflow_sha'])if(typeof p[field]!=='string'||! /^[a-f0-9]{40}$/.test(p[field] as string))return 403;
  if(p.sha!==p.workflow_sha)return 403;
  for(const field of ['run_id','run_attempt'])if(typeof p[field]!=='string'||! /^[1-9][0-9]*$/.test(p[field] as string))return 403;
  return 200;
 }catch{return 403;}
}
