import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerDiagnosticRequest,verifiedDiagnosticOwner,boundedOwnerSession,OWNER_DIAGNOSTIC_WINDOW} from '../lib/research/owner-data-diagnostic';
import {dataReadinessDiagnostic} from '../lib/research/data-readiness-diagnostic';
const now=new Date('2026-11-17T12:00:00Z'),window={opensAt:now.toISOString(),expiresAt:'2026-11-17T12:15:00Z'};
const headers={origin:'https://tradeos-lac.vercel.app','sec-fetch-site':'same-origin','x-tradeos-diagnostic':'owner-read-only-v1'};
const request=(extra:RequestInit={},url='https://tradeos-lac.vercel.app/api/operations/owner-data-readiness')=>new Request(url,{method:'POST',headers,...extra});
test('draft disabled; only fixed-origin bodyless same-origin POST fits approved window',()=>{
 assert.equal(OWNER_DIAGNOSTIC_WINDOW,null);assert.equal(ownerDiagnosticRequest(request(),null,now),409);
 assert.equal(ownerDiagnosticRequest(request(),window,now),200);
 for(const bad of [request({method:'GET'}),request({headers:{...headers,origin:'https://evil.invalid'}}),request({headers:{...headers,'sec-fetch-site':'cross-site'}}),request({headers:{origin:headers.origin}}),request({},'https://preview.vercel.app/api/operations/owner-data-readiness')])assert.equal(ownerDiagnosticRequest(bad,window,now),403);
 for(const bad of [request({body:'{}'}),request({},'https://tradeos-lac.vercel.app/api/operations/owner-data-readiness?symbol=SPY')])assert.equal(ownerDiagnosticRequest(bad,window,now),400);
 for(const at of ['2026-11-17T11:59:59Z','2026-11-17T12:14:00.001Z','invalid'])assert.equal(ownerDiagnosticRequest(request(),window,new Date(at)),409);
 assert.equal(ownerDiagnosticRequest(request(),{...window,expiresAt:'2026-11-17T12:16:00Z'},now),409);
});
test('owner ID and current verified unbanned admin record required; mismatch never reads DB',async()=>{
 const never=async()=>assert.fail('must not query');
 for(const [id,expected] of [[undefined,'owner'],['other','owner'],['owner',undefined],['','']])assert.equal(await verifiedDiagnosticOwner(id,expected,never),false);
 const good={role:'admin',banned:false,verified:true};
 assert.equal(await verifiedDiagnosticOwner('owner','owner',async()=>[good]),true);
 for(const rows of [[],[{...good,role:'user'}],[{...good,banned:true}],[{...good,verified:false}]])assert.equal(await verifiedDiagnosticOwner('owner','owner',async()=>rows),false);
});
test('session verification is bounded and cannot continue into diagnostic after timeout',async()=>{
 await assert.rejects(boundedOwnerSession(()=>new Promise(()=>{}),5),/session_timeout/);
 assert.deepEqual(await boundedOwnerSession(async()=>({id:'owner'}),5),{id:'owner'});
});
test('owner authorization time consumes original deadline; provider clock cannot reset it',async()=>{
 const sql=async(s:TemplateStringsArray)=>s.join('').includes('current_user')?[{runtime_role:'owner',database:'test',read_only:'on'}]:[{present:true,readable:true,writable:true,protected:true,sequence_usable:true,exact_columns:2,executable:true}];
 await assert.rejects(dataReadinessDiagnostic({sql,deadline:+now+14000,feed:'iex',clock:()=>now,history:async()=>assert.fail('late auth must not allow provider call')}),/provider_budget/);
});
test('actual owner route is closed with draft policy before session, database or provider work',async()=>{
 const prior={base:process.env.NEON_AUTH_BASE_URL,cookie:process.env.NEON_AUTH_COOKIE_SECRET};
 try{
  process.env.NEON_AUTH_BASE_URL='https://auth.example.invalid';process.env.NEON_AUTH_COOKIE_SECRET='nonsecret-test-placeholder-1234567890';
  const {POST}=await import('../app/api/operations/owner-data-readiness/route');
  const response=await POST(request());assert.equal(response.status,409);assert.equal(response.headers.get('cache-control'),'private, no-store');
 }finally{
  for(const [key,value] of [['NEON_AUTH_BASE_URL',prior.base],['NEON_AUTH_COOKIE_SECRET',prior.cookie]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;
 }
});
