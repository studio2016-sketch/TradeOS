import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {privateReadStatus,withPrivateRead,type PrivateReadDependencies} from '../lib/auth/private-read';
const good:PrivateReadDependencies={session:async()=>({data:{user:{id:'owner'}}}),ownerId:()=>'owner',account:async()=>({id:'owner',role:'admin',verified:true,banned:false})};
test('verified configured owner with trusted current account alone is allowed',async()=>{
 assert.equal(await privateReadStatus(good),200);
 for(const row of [undefined,{id:'other',role:'admin',verified:true,banned:false},{id:'owner',role:'user',verified:true,banned:false},{id:'owner',role:'admin',verified:false,banned:false},{id:'owner',role:'admin',verified:true,banned:true},{id:'owner',role:'admin',verified:true}])assert.equal(await privateReadStatus({...good,account:async()=>row}),403);
});
test('anonymous, mismatched identity and configuration failures deny before private reads',async()=>{
 const never=async()=>assert.fail('no account lookup permitted');
 for(const session of [null,{}, {data:{user:{}}},{data:{user:{id:123}}}])assert.equal(await privateReadStatus({...good,session:async()=>session,account:never}),401);
 assert.equal(await privateReadStatus({...good,session:async()=>({data:{user:{id:'other'}}}),account:never}),403);
 assert.equal(await privateReadStatus({...good,ownerId:()=>undefined,account:never}),503);
 assert.equal(await privateReadStatus({...good,session:async()=>{throw Error('secret must not leak');}}),503);
 assert.equal(await privateReadStatus({...good,account:async()=>{throw Error('SQL private');}}),503);
});
test('timeout fails closed and never executes the private handler after late completion',async()=>{
 let resolve!:(v:unknown)=>void;let reads=0;
 const deps={...good,session:()=>new Promise(r=>{resolve=r;})};
 const get=withPrivateRead(async()=>{reads++;return Response.json({private:true});},()=>privateReadStatus(deps,5));
 const r=await get();assert.equal(r.status,503);resolve({data:{user:{id:'owner'}}});await new Promise(r=>setTimeout(r,10));assert.equal(reads,0);
});
test('guard precedes handler, denies with no private details, and marks every response private',async()=>{
 for(const status of [401,403,503] as const){const r=await withPrivateRead(async()=>assert.fail('private handler called'),async()=>status)();assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.deepEqual(Object.keys(await r.json()),['error']);}
 const r=await withPrivateRead(async(a:number)=>Response.json({value:a},{headers:{'Cache-Control':'public,max-age=3600'}}),async()=>200)(42);
 assert.deepEqual(await r.json(),{value:42});assert.equal(r.headers.get('cache-control'),'private, no-store');assert.match(r.headers.get('vary')||'',/Cookie/);
});
test('all GET APIs require an explicit shared or preexisting guard; auth callback remains public',()=>{
 function walk(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
 for(const file of walk('app/api').filter(x=>x.endsWith('/route.ts'))){
  const src=fs.readFileSync(file,'utf8');
  if(file==='app/api/auth/[...path]/route.ts'){assert.match(src,/auth.handler\(\)/);continue;}
  if(/export const GET=withPrivateRead\(privateGET\)/.test(src))continue;
  const m=src.match(/export async function GET\([^)]*\)\s*\{([\s\S]*)/);if(!m)continue;
  const body=m[1].split(/\nexport (?:async function|const) /)[0];
  assert.match(body,/authorizeIngest\(|authorizeCron\(|auth.getSession\(|await owner\(\)|await authorized\(\)/,file);
 }
});
test('private pages server-gate before rendering; login/reset/verification pages remain reachable',()=>{
 const inventory=JSON.parse(fs.readFileSync('tests/private-route-inventory.json','utf8'));
 for(const file of inventory.privatePages){const src=fs.readFileSync(file,'utf8');assert.ok(!src.includes('use client'));assert.ok(src.indexOf('await currentPrivateReadStatus()')<src.indexOf('return <PrivatePage'));assert.match(src,/if\(status===401\)redirect\("\/sign-in"\)/);assert.match(src,/if\(status!==200\)return/);assert.match(src,/dynamic="force-dynamic"/);}
 for(const route of ['sign-in','reset-password','forgot-password','verify-email'])assert.ok(!fs.readFileSync(`app/${route}/page.tsx`,'utf8').includes('currentPrivateReadStatus'));
});
test('nullable unbanned account preserves existing owner semantics; malformed states deny',async()=>{
 assert.equal(await privateReadStatus({...good,account:async()=>({id:'owner',role:'admin',verified:true,banned:null})}),200);
 for(const banned of ['false',0,undefined])assert.equal(await privateReadStatus({...good,account:async()=>({id:'owner',role:'admin',verified:true,banned})}),403);
});
test('analysis composes guarded handlers in process, without forwarding cookies or request origins',()=>{
 const alignment=fs.readFileSync('app/api/alignment/route.ts','utf8');
 for(const name of ['assessment','calibration','intelligence']){assert.match(alignment,new RegExp(`GET as ${name}GET`));assert.ok(alignment.includes(`${name}GET().then(r=>r.ok?r.json():null)`));}
 const paper=fs.readFileSync('app/api/research-paper/route.ts','utf8');assert.match(paper,/GET as alignmentGET/);assert.ok(paper.includes('alignmentGET(new Request("https://internal.invalid/'));
 for(const src of [alignment,paper]){assert.ok(!src.includes('fetch(origin'));assert.ok(!src.includes('headers.get("cookie")'));}
 assert.match(fs.readFileSync('app/api/opportunity-assessment/route.ts','utf8'),/export const POST=withPrivateRead\(privatePOST\)/);
});
test('SDK-reported failures cannot masquerade as an anonymous or authenticated success',async()=>{
 for(const session of [{error:{message:'upstream private error'}},{data:{user:{id:'owner'}},error:{message:'failure'}}])assert.equal(await privateReadStatus({...good,session:async()=>session,account:async()=>assert.fail('must not query after auth failure')}),503);
});
