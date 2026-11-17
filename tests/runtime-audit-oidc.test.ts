import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {authorizeOidcAudit,AUDIT_ISSUER,AUDIT_AUDIENCE,auditRequestScope} from '../lib/auth/runtime-audit-oidc';
const now=new Date('2026-11-17T15:00:00Z'),t=Math.floor(+now/1000);
let pair:Awaited<ReturnType<typeof generateKeyPair>>;
let key:ReturnType<typeof createLocalJWKSet>;
before(async()=>{pair=await generateKeyPair('RS256');key=createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:'test',alg:'RS256',use:'sig'}]});});
const base={iss:AUDIT_ISSUER,aud:AUDIT_AUDIENCE,sub:'repo:studio2016-sketch@331044643/TradeOS@1409039268:ref:refs/heads/main',iat:t,nbf:t,exp:t+300,jti:'unique-job-token',repository:'studio2016-sketch/TradeOS',repository_id:'1409039268',repository_owner:'studio2016-sketch',repository_owner_id:'331044643',ref:'refs/heads/main',ref_type:'branch',runner_environment:'github-hosted',event_name:'schedule',workflow_ref:'studio2016-sketch/TradeOS/.github/workflows/private-runtime-audit.yml@refs/heads/main',sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),run_id:'123',run_attempt:'1'};
async function signed(overrides:Record<string,unknown>={},headers:Record<string,unknown>={}){
 return new SignJWT({...base,...overrides}).setProtectedHeader({alg:'RS256',kid:'test',typ:'JWT',...headers}).sign(pair.privateKey);
}
function req(token?:string,path='/api/private-runtime-audit'){return new Request('https://tradeos-lac.vercel.app'+path,{headers:token?{authorization:'Bearer '+token}:{}});}
test('valid signed GitHub job admits only its exact fixed scope',async()=>{
 assert.equal(await authorizeOidcAudit(req(await signed()),key,now),200);
 assert.equal(await authorizeOidcAudit(req(await signed({sub:'repo:studio2016-sketch/TradeOS:ref:refs/heads/main'})),key,now),200);
 for(const [scope,file,path] of [['sources','extended-production-audit','detailed'],['models','model-runtime-audit','detailed'],['graph','knowledge-graph-production','detailed'],['readiness','broker-clock-readiness','market'],['advancement','market-hours-advance','market']]){
 const token=await signed({workflow_ref:`studio2016-sketch/TradeOS/.github/workflows/${file}.yml@refs/heads/main`});
 assert.equal(await authorizeOidcAudit(req(token,`/api/private-${path}-audit?scope=${scope}`),key,now),200);
 assert.equal(await authorizeOidcAudit(req(token),key,now),403);
 }
});
test('wrong issuer, audience, identity, branch, event, workflow and privilege context fail closed',async()=>{
 for(const change of [{iss:'https://evil.invalid'},{aud:'other'},{aud:[AUDIT_AUDIENCE,'other']},{repository_id:'2'},{repository_owner_id:'2'},{repository:'fork/TradeOS'},{repository_owner:'other'},{ref:'refs/heads/feature'},{ref_type:'tag'},{runner_environment:'self-hosted'},{event_name:'pull_request'},{event_name:'pull_request_target'},{event_name:'push'},{event_name:'dynamic'},{event_name:['schedule']},{workflow_ref:'studio2016-sketch/TradeOS/.github/workflows/evil.yml@refs/heads/main'},{sub:'repo:studio2016-sketch/TradeOS:pull_request'},{environment:'production'},{job_workflow_ref:'anything'},{head_ref:'pr'},{sha:'b'.repeat(40)},{run_id:123},{jti:''}]){
 assert.equal(await authorizeOidcAudit(req(await signed(change)),key,now),403,JSON.stringify(change));
 }
});
test('signature, JWT header, time bounds and malformed input fail closed',async()=>{
 assert.equal(await authorizeOidcAudit(req(),key,now),401);
 for(const token of ['bad','a'.repeat(17000), (await signed()).slice(0,-10)+'aaaaaaaaaa'])assert.equal(await authorizeOidcAudit(req(token),key,now),403);
 for(const change of [{exp:t},{exp:t+601},{iat:t+1},{iat:t-301},{nbf:t+1},{exp:t+0.5},{iat:undefined},{nbf:undefined}])assert.equal(await authorizeOidcAudit(req(await signed(change)),key,now),403);
 for(const h of [{typ:'other'},{jku:'https://evil.invalid'},{kid:'unknown'}])assert.equal(await authorizeOidcAudit(req(await signed({},h)),key,now),403);
 const failed=async()=>{throw new Error('private internal error');};
 assert.equal(await authorizeOidcAudit(req(await signed()),failed,now),403);
});
test('owner APIs, mutations, duplicate or extra parameters are never OIDC scopes',async()=>{
 const token=await signed();
 for(const path of ['/api/market','/api/forecasts','/','/api/private-runtime-audit?x=1','/api/private-detailed-audit?scope=sources&scope=models','/api/private-market-audit?scope=graph'])assert.equal(await authorizeOidcAudit(req(token,path),key,now),403);
 assert.equal(auditRequestScope(new Request('https://tradeos-lac.vercel.app/api/private-runtime-audit',{method:'POST'})),null);
});
