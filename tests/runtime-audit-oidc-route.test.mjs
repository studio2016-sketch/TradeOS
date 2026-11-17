import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {generateKeyPair,exportJWK,SignJWT} from 'jose';
const hooks=registerHooks({resolve(s,c,next){if(s.includes('/internal-audit-models/'))return next(new URL('./fixtures/detailed-audit-services.mjs?name='+s.split('/').at(-1),import.meta.url).href,c);return next(s,c);}});
test('actual endpoint verifies OIDC via fixed JWKS, denies cross-scope before private calls and never falls back',async()=>{
 const pair=await generateKeyPair('RS256'),jwk={...await exportJWK(pair.publicKey),kid:'local-oidc',alg:'RS256',use:'sig'};
 const priorHash=process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=createHash('sha256').update('ab'.repeat(32)).digest('hex');
 const prior=process.env.TRADEOS_RUNTIME_AUDIT_AUTH_MODE,priorEnv=process.env.VERCEL_ENV,oldFetch=globalThis.fetch;
 process.env.VERCEL_ENV='production';
 process.env.TRADEOS_RUNTIME_AUDIT_AUTH_MODE='github-oidc';
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://token.actions.githubusercontent.com/.well-known/jwks');assert.equal(options.redirect,'manual');return Response.json({keys:[jwk]});};
 const {GET}=await import('../app/api/private-detailed-audit/route.ts');
 const now=Math.floor(Date.now()/1000);
 const claims={iss:'https://token.actions.githubusercontent.com',aud:'https://tradeos-lac.vercel.app/private-audit',sub:'repo:studio2016-sketch@331044643/TradeOS@1409039268:ref:refs/heads/main',iat:now,nbf:now,exp:now+300,jti:'test',repository:'studio2016-sketch/TradeOS',repository_id:'1409039268',repository_owner:'studio2016-sketch',repository_owner_id:'331044643',ref:'refs/heads/main',ref_type:'branch',runner_environment:'github-hosted',event_name:'schedule',workflow_ref:'studio2016-sketch/TradeOS/.github/workflows/knowledge-graph-production.yml@refs/heads/main',sha:'a'.repeat(40),workflow_sha:'a'.repeat(40),run_id:'123',run_attempt:'1'};
 const token=await new SignJWT(claims).setProtectedHeader({alg:'RS256',typ:'JWT',kid:'local-oidc'}).sign(pair.privateKey);
 const req=(scope,bearer=token)=>new Request('https://audit.invalid/api/private-detailed-audit?scope='+scope,{headers:{authorization:'Bearer '+bearer}});
 globalThis.__detailedCalls=[];globalThis.__detailedFixtures={};
 try{
  assert.equal((await GET(req('models'))).status,403);assert.equal(globalThis.__detailedCalls.length,0);
  assert.equal((await GET(req('graph','ab'.repeat(32)))).status,403);assert.equal(globalThis.__detailedCalls.length,0);
  const r=await GET(req('graph'));assert.equal(r.status,503);assert.equal(globalThis.__detailedCalls.length,3);assert.equal(r.headers.get('cache-control'),'private, no-store');
  const body=await r.text();assert.ok(!body.includes(token));assert.ok(!body.includes('local-oidc'));assert.equal(JSON.parse(body).scope,'graph');
  process.env.VERCEL_ENV='preview';assert.equal((await GET(req('graph'))).status,503);
  process.env.VERCEL_ENV='production';process.env.TRADEOS_RUNTIME_AUDIT_AUTH_MODE='typo';assert.equal((await GET(req('graph'))).status,503);
 }finally{if(priorHash===undefined)delete process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;else process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=priorHash;if(priorEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=priorEnv;globalThis.fetch=oldFetch;hooks.deregister();delete globalThis.__detailedCalls;delete globalThis.__detailedFixtures;if(prior===undefined)delete process.env.TRADEOS_RUNTIME_AUDIT_AUTH_MODE;else process.env.TRADEOS_RUNTIME_AUDIT_AUTH_MODE=prior;}
});
