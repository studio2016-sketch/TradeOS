import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authorizeRuntimeAudit} from '../lib/auth/runtime-audit';
import {runtimeAudit} from '../lib/operations/runtime-audit';
import fs from 'node:fs';
const token='ab'.repeat(32),hash=createHash('sha256').update(token).digest('hex');
const req=(token?:string)=>new Request('https://tradeos.invalid/api/private-runtime-audit',{headers:token?{authorization:token}:{}});
test('audit capability fails closed; exact separate credential required',()=>{
 assert.equal(authorizeRuntimeAudit(req(),hash),401);
 for(const value of ['', 'bad'])assert.equal(authorizeRuntimeAudit(req('Bearer '+token),value),503);
 for(const value of [token,'bearer '+token,'Bearer '+'cd'.repeat(32),'Bearer '+token+'x'])assert.equal(authorizeRuntimeAudit(req(value),hash),403);
 assert.equal(authorizeRuntimeAudit(req('Bearer '+token),hash),200);
});
test('only explicit heartbeat booleans survive projection; private fields and errors never serialize',async()=>{
 const now=Date.parse('2026-11-17T12:00:00Z');
 const report=await runtimeAudit({now:()=>now,probe:async()=>({database_ok:1,last_ingestion:new Date(now-100),last_research:new Date(now-100).toISOString(),secret:'do-not-copy',equity:987654321})});
 assert.equal(report.databaseReachable,true);assert.equal(report.ingestionObservedWithin12Minutes,true);assert.equal(report.researchObservedWithin40Minutes,true);
 assert.equal(report.modelValidated,false);assert.equal(report.ownerSessionVerified,false);
 assert.ok(!JSON.stringify(report).includes('do-not-copy'));assert.ok(!JSON.stringify(report).includes('987654321'));
 for(const last_ingestion of ['bad',new Date(now+1),new Date(now-720001),null,1])assert.equal((await runtimeAudit({now:()=>now,probe:async()=>({database_ok:1,last_ingestion})})).ingestionObservedWithin12Minutes,false);
 const failure=await runtimeAudit({now:()=>now,probe:async()=>{throw Error('private database URL');}});assert.equal(failure.databaseReachable,false);assert.ok(!JSON.stringify(failure).includes('private database URL'));
 const timeout=await runtimeAudit({now:()=>now,probe:()=>new Promise(()=>{})},2);assert.equal(timeout.databaseReachable,false);
});
test('runtime capability has no bypass into owner research; route authorization precedes DB import',()=>{
 const route=fs.readFileSync('app/api/private-runtime-audit/route.ts','utf8');
 assert.ok(route.indexOf('if(status!==200)')<route.indexOf("import('../../../lib/db')"));
 assert.match(route,/parameters_not_allowed/);assert.ok(!/insert|update|delete|broker|fetch\(/i.test(route));
 assert.ok(!fs.readFileSync('lib/auth/private-read.ts','utf8').includes('RuntimeAudit'));
});
test('actual audit endpoint denies missing/wrong credentials and query parameters before touching database',async()=>{
 const {GET}=await import('../app/api/private-runtime-audit/route');
 const before=process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;
 try{
  delete process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;
  assert.equal((await GET(req())).status,503);
  process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=hash;
  assert.equal((await GET(req())).status,401);
  assert.equal((await GET(req('Bearer '+'cd'.repeat(32)))).status,403);
  const response=await GET(new Request('https://tradeos.invalid/api/private-runtime-audit?private=1',{headers:{authorization:'Bearer '+token}}));
  assert.equal(response.status,400);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Authorization');
 }finally{if(before===undefined)delete process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;else process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=before;}
});
