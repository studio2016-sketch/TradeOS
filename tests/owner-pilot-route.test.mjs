import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
const mocks=['/lib/auth/server','/lib/db','/lib/research/data-activation-policy','/lib/research/data-storage-readiness','/lib/research/daily-factor-runner'];
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(mocks.some(x=>specifier.endsWith(x)))return nextResolve(new URL('./fixtures/owner-pilot-services.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {POST}=await import('../app/api/operations/owner-daily-pilot/route.ts');
const url='https://tradeos-lac.vercel.app/api/operations/owner-daily-pilot';
const headers={origin:'https://tradeos-lac.vercel.app','sec-fetch-site':'same-origin','x-tradeos-daily-pilot':'owner-pilot-v1'};
const request=(extra={})=>new Request(url,{method:'POST',headers,...extra});
const fixture=()=>({
 approval:{id:'test-only',session:'2026-11-16',opensAt:'2026-11-16T21:30:00Z',expiresAt:'2026-11-16T22:30:00Z'},
 session:{data:{user:{id:'owner'}}},account:{id:'owner',role:'admin',verified:true,banned:false},calls:[]
});
test('enabled owner route uses actual approval/auth/budget gates with isolated non-writing services',async()=>{
 const oldNow=Date.now,oldOwner=process.env.TRADEOS_OWNER_USER_ID;
 Date.now=()=>Date.parse('2026-11-16T22:00:00Z');process.env.TRADEOS_OWNER_USER_ID='owner';
 try{
  let f=globalThis.__ownerPilot=fixture();
  const ok=await POST(request());assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'private, no-store');
  const body=await ok.json();assert.equal(body.approvalId,'test-only');assert.equal(body.ordersAllowed,false);assert.equal(body.certified,false);
  assert.deepEqual(f.calls,['session','readonly','preflight','run']);
  for(const state of ['sdk-error','anonymous','wrong-owner','banned','malformed-banned','mismatched-account']){
   f=globalThis.__ownerPilot=fixture();
   if(state==='sdk-error')f.session.error={message:'private'};
   if(state==='anonymous')f.session=null;
   if(state==='wrong-owner')f.session.data.user.id='other';
   if(state==='banned')f.account.banned=true;
   if(state==='malformed-banned')delete f.account.banned;
   if(state==='mismatched-account')f.account.id='other';
   const r=await POST(request());assert.equal(r.status,state==='sdk-error'?503:state==='anonymous'?401:403,state);
   assert.ok(!f.calls.includes('preflight'));assert.ok(!f.calls.includes('run'));
  }
  for(const extra of [{headers:{...headers,origin:'https://evil.invalid'}},{body:'{}'}]){
   f=globalThis.__ownerPilot=fixture();const r=await POST(request(extra));assert.ok([400,403].includes(r.status));assert.deepEqual(f.calls,[]);
  }
  for(const stage of ['expired','wrong-session','preflight','run']){
   f=globalThis.__ownerPilot=fixture();
   if(stage==='expired')f.approval.expiresAt='2026-11-16T21:59:00Z';
   if(stage==='wrong-session')f.approval.session='2026-11-13';
   if(stage==='preflight')f.failPreflight=true;
   if(stage==='run')f.failRun=true;
   const r=await POST(request());assert.equal(r.status,503);const b=await r.json();assert.equal(b.retryAllowed,false);assert.equal(b.status,'daily_invocation_unconfirmed');assert.ok(!JSON.stringify(b).includes('private fixture'));
   if(stage!=='run')assert.ok(!f.calls.includes('run'));
  }
  f=globalThis.__ownerPilot=fixture();f.approval=null;assert.equal((await POST(request())).status,409);assert.deepEqual(f.calls,[]);
 }finally{hooks.deregister();Date.now=oldNow;if(oldOwner===undefined)delete process.env.TRADEOS_OWNER_USER_ID;else process.env.TRADEOS_OWNER_USER_ID=oldOwner;delete globalThis.__ownerPilot;}
});
