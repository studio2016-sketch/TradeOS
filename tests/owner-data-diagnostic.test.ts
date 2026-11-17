import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerDiagnosticRequest,verifiedDiagnosticOwner,boundedOwnerSession,emptyOwnerDiagnosticBody,OWNER_DIAGNOSTIC_WINDOW} from '../lib/research/owner-data-diagnostic';
import {dataReadinessDiagnostic} from '../lib/research/data-readiness-diagnostic';
const now=new Date('2026-11-17T12:00:00Z'),window={opensAt:now.toISOString(),expiresAt:'2026-11-17T12:15:00Z'};
const headers={origin:'https://tradeos-lac.vercel.app','sec-fetch-site':'same-origin','x-tradeos-diagnostic':'owner-read-only-v1'};
const request=(extra:RequestInit={},url='https://tradeos-lac.vercel.app/api/operations/owner-data-readiness')=>new Request(url,{method:'POST',headers,...extra});
test('release window is pinned; only fixed-origin bodyless same-origin POST fits approved window',()=>{
 assert.deepEqual(OWNER_DIAGNOSTIC_WINDOW,{opensAt:'2026-11-17T07:50:00Z',expiresAt:'2026-11-17T08:05:00Z'});assert.ok(Object.isFrozen(OWNER_DIAGNOSTIC_WINDOW));assert.equal(ownerDiagnosticRequest(request(),null,now),409);
 assert.equal(ownerDiagnosticRequest(request(),window,now),200);
 for(const bad of [request({method:'GET'}),request({headers:{...headers,origin:'https://evil.invalid'}}),request({headers:{...headers,'sec-fetch-site':'cross-site'}}),request({headers:{origin:headers.origin}}),request({},'https://preview.vercel.app/api/operations/owner-data-readiness')])assert.equal(ownerDiagnosticRequest(bad,window,now),403);
 for(const bad of [request({},'https://tradeos-lac.vercel.app/api/operations/owner-data-readiness?symbol=SPY')])assert.equal(ownerDiagnosticRequest(bad,window,now),400);
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
test('actual owner route rejects cross-origin requests before session, database or provider work',async()=>{
 const prior={base:process.env.NEON_AUTH_BASE_URL,cookie:process.env.NEON_AUTH_COOKIE_SECRET};
 try{
  process.env.NEON_AUTH_BASE_URL='https://auth.example.invalid';process.env.NEON_AUTH_COOKIE_SECRET='nonsecret-test-placeholder-1234567890';
  const {POST}=await import('../app/api/operations/owner-data-readiness/route');
  const response=await POST(request({headers:{...headers,origin:'https://evil.invalid'}}));assert.equal(response.status,403);assert.equal(response.headers.get('cache-control'),'private, no-store');
 }finally{
  for(const [key,value] of [['NEON_AUTH_BASE_URL',prior.base],['NEON_AUTH_COOKIE_SECRET',prior.cookie]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;
 }
});

test('actual Next.js Node adapter zero-byte POST passes; streamed bytes fail closed',async()=>{
 const {Readable}=await import('node:stream');
 const {NextRequestAdapter}=await import('next/dist/server/web/spec-extension/adapters/next-request');
 const adapted=(chunks:string[])=>NextRequestAdapter.fromNodeNextRequest({method:'POST',url:'https://tradeos-lac.vercel.app/api/operations/owner-data-readiness',headers:{...headers,'content-length':'0'},body:Readable.from(chunks)} as any,new AbortController().signal);
 const empty=adapted([]);
 assert.notEqual(empty.body,null,'regression: framework provides stream for an empty POST');
 assert.equal(ownerDiagnosticRequest(empty,window,now),200);
 assert.equal(await emptyOwnerDiagnosticBody(empty),true);
 assert.equal(await emptyOwnerDiagnosticBody(adapted(['x'])),false,'lying zero content length cannot bypass bytes');
 assert.equal(await emptyOwnerDiagnosticBody(request({body:'{}'})),false);
 assert.equal(await emptyOwnerDiagnosticBody(request()),true);
});
test('body inspection rejects stalled, broken, consumed and locked streams',async()=>{
 const streamed=(body:ReadableStream)=>request({body,duplex:'half'} as RequestInit);
 assert.equal(await emptyOwnerDiagnosticBody(streamed(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){return new Promise(()=>{});}})),10),false);
 assert.equal(await emptyOwnerDiagnosticBody(streamed(new ReadableStream({start(c){c.error(Error('broken'));}}))),false);
 const consumed=request({body:'x'});await consumed.text();assert.equal(await emptyOwnerDiagnosticBody(consumed),false);
 const locked=request({body:'x'});const reader=locked.body!.getReader();assert.equal(await emptyOwnerDiagnosticBody(locked),false);reader.releaseLock();
});
