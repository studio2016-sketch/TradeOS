import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='../db'&&context.parentURL?.endsWith('/lib/market/news.ts'))return nextResolve(new URL('./fixtures/news-provider-transport.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
after(()=>hooks.deregister());
const {alpacaNews,massiveNews}=await import('../lib/market/news.ts');
const providers=[['alpaca',alpacaNews,50,30],['massive',massiveNews,20,60]];
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function fixture(provider,seconds,run){
 const originalFetch=globalThis.fetch,keys=Object.fromEntries(['ALPACA_API_KEY','ALPACA_API_SECRET','MASSIVE_API_KEY'].map(k=>[k,process.env[k]]));
 for(const key of Object.keys(keys))process.env[key]='fixture';
 const calls=[],slots=[],holds=[],cache=[];let grant=true;
 const timestamp=new Date(Date.now()-60000).toISOString();
 globalThis.__newsProviderSql=async(strings,...values)=>{
  const query=strings.join('?');
  if(query.includes('insert into tradeos_news_ingestion_runs'))return[{id:1}];
  if(query.includes('insert into tradeos_provider_rate_limits')){slots.push(values);assert.equal(values[1],seconds);return grant?[{provider}]:[];}
  if(query.includes('select article_id'))return cache;
  if(query.includes('insert into tradeos_news_articles')||query.includes('update tradeos_news_ingestion_runs'))return[];
  throw Error('Unexpected fixture SQL');
 };
 globalThis.fetch=async input=>{
  const url=new URL(input),hold=deferred(),entered=holds.shift();calls.push({url,hold});entered?.resolve();
  const fail=await hold.promise;if(fail)throw Error('Synthetic transport failure');
  const symbols=(url.searchParams.get('symbols')??'GLOBAL').split(',');
  return Response.json(provider==='alpaca'?{news:[{id:calls.length,created_at:timestamp,headline:'Synthetic article',symbols}]}:{results:[{id:String(calls.length),published_utc:timestamp,title:'Synthetic article',tickers:['GLOBAL']}]});
 };
 const state={calls,slots,cache,timestamp,deny(){grant=false;},next(){const d=deferred();holds.push(d);return d.promise;}};
 try{await run(state);}finally{
  for(const call of calls)call.hold.resolve();
  globalThis.fetch=originalFetch;delete globalThis.__newsProviderSql;
  for(const [key,value]of Object.entries(keys)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
}
for(const [provider,fetchNews,cap,seconds] of providers){
 test(`${provider}: canonical symbols and capped limits share one request with isolated results`,{timeout:3000},()=>fixture(provider,seconds,async s=>{
  const entered=s.next(),a=fetchNews(['bbb','AAA','AAA'],cap);await entered;
  const b=fetchNews(['AAA','BBB'],cap+10);s.calls[0].hold.resolve();
  const [first,second]=await Promise.all([a,b]);assert.equal(s.calls.length,1);assert.equal(s.slots.length,1);
  assert.equal(s.calls[0].url.searchParams.get('limit'),String(cap));
  first[0].headline='Changed';first[0].symbols.push('MUTATED');first.push(first[0]);
  assert.equal(second.length,1);assert.equal(second[0].headline,'Synthetic article');assert.ok(!second[0].symbols.includes('MUTATED'));
 }));
 test(`${provider}: different symbols stay separate and finishing one does not clear another`,{timeout:3000},()=>fixture(provider,seconds,async s=>{
  let entered=s.next();const a=fetchNews(['AAA'],1);await entered;
  entered=s.next();const b=fetchNews(['BBB'],1);await entered;
  s.calls[0].hold.resolve();await a;
  const again=fetchNews(['BBB'],1);s.calls[1].hold.resolve();
  const [first,second]=await Promise.all([b,again]);assert.equal(s.calls.length,2);assert.deepEqual(first,second);
  if(provider==='alpaca')assert.deepEqual(first[0].symbols,['BBB']);
 }));
 test(`${provider}: distinct limits have distinct requests`,{timeout:3000},()=>fixture(provider,seconds,async s=>{
  let entered=s.next();const a=fetchNews(['AAA'],1);await entered;
  entered=s.next();const b=fetchNews(['AAA'],3);await entered;
  s.calls.forEach(c=>c.hold.resolve());await Promise.all([a,b]);
  assert.deepEqual(s.calls.map(c=>c.url.searchParams.get('limit')),['1','3']);
 }));
 test(`${provider}: unrelated callers retain their own cache when shared budget denies a slot`,{timeout:3000},()=>fixture(provider,seconds,async s=>{
  const entered=s.next(),a=fetchNews(['AAA'],1);await entered;s.deny();
  for(const symbol of ['AAA','BBB'])s.cache.push({article_id:symbol,published_at:s.timestamp,headline:`Cached ${symbol}`,symbols:[symbol],source_name:'Fixture',source_quality:.8});
  const b=await fetchNews(['BBB'],1);assert.deepEqual(b.map(n=>n.id),['BBB']);assert.equal(s.calls.length,1);assert.equal(s.slots.length,2);
  s.calls[0].hold.resolve();await a;
 }));
 test(`${provider}: rejected shared requests are cleared for subsequent attempts`,{timeout:3000},()=>fixture(provider,seconds,async s=>{
  let entered=s.next();const a=fetchNews(['AAA'],1);await entered;const b=fetchNews(['AAA'],1);
  const settled=Promise.allSettled([a,b]);s.calls[0].hold.resolve(true);assert.ok((await settled).every(r=>r.status==='rejected'));
  entered=s.next();const retry=fetchNews(['AAA'],1);await entered;s.calls[1].hold.resolve();await retry;assert.equal(s.calls.length,2);
 }));
 test(`${provider}: invalid limits fail before SQL or transport`,()=>fixture(provider,seconds,async s=>{
  for(const limit of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])await assert.rejects(fetchNews(['AAA'],limit),RangeError);
  assert.equal(s.calls.length,0);assert.equal(s.slots.length,0);
 }));
}
