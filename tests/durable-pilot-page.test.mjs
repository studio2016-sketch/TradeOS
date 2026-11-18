import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='next/navigation'||specifier.endsWith('/lib/auth/private-read')||specifier.endsWith('/lib/research/durable-pilot-receipt'))return nextResolve(new URL('./fixtures/durable-pilot-page-services.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {default:Page}=await import('../app/operations/daily-pilot/page.tsx');
test('actual page never reads receipt for anonymous, nonowner, banned-style or unavailable authorization',async()=>{
 try{
  for(const status of [401,403,503]){
   const f=globalThis.__receiptPage={status,calls:[]};
   if(status===401)await assert.rejects(Page(),/redirect:\/sign-in/);else {const page=await Page();assert.equal(page.type,'main');}
   assert.deepEqual(f.calls,['authorize']);
  }
  const f=globalThis.__receiptPage={status:200,calls:[]};const page=await Page();assert.deepEqual(f.calls,['authorize','receipt']);assert.equal(page.props.enabled,false);assert.equal(page.props.receipt.props.receipt.status,'none');
 }finally{hooks.deregister();delete globalThis.__receiptPage;}
});
