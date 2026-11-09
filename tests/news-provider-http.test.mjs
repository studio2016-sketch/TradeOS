import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='../db'&&context.parentURL?.endsWith('/lib/market/news.ts'))return nextResolve(new URL('./fixtures/news-provider-transport.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {alpacaNews,massiveNews}=await import('../lib/market/news.ts');
test('actual provider HTTP adapters reject missing clocks before caching and report raw/accepted counts',async()=>{
 const originalFetch=globalThis.fetch,keys={ALPACA_API_KEY:process.env.ALPACA_API_KEY,ALPACA_API_SECRET:process.env.ALPACA_API_SECRET,MASSIVE_API_KEY:process.env.MASSIVE_API_KEY};
 process.env.ALPACA_API_KEY='fixture';process.env.ALPACA_API_SECRET='fixture';process.env.MASSIVE_API_KEY='fixture';
 try{
  for(const [provider,fetchNews] of [['alpaca',alpacaNews],['massive',massiveNews]]){
   const writes=[],receipts=[];let requests=0;
   globalThis.__newsProviderSql=async(strings,...values)=>{
    const query=strings.join('?');
    if(query.includes('insert into tradeos_news_ingestion_runs'))return[{id:1}];
    if(query.includes('insert into tradeos_provider_rate_limits'))return[{provider}];
    if(query.includes('insert into tradeos_news_articles')){writes.push(values);return[];}
    if(query.includes('update tradeos_news_ingestion_runs')){receipts.push(values);return[];}
    throw Error('Unexpected fixture SQL');
   };
   const timestamp=new Date(Date.now()-60000).toISOString();
   globalThis.fetch=async(url)=>{
    requests++;assert.equal(new URL(url).hostname,provider==='alpaca'?'data.alpaca.markets':'api.massive.com');
    return Response.json(provider==='alpaca'?{news:[{id:1,created_at:timestamp,headline:'Synthetic valid',symbols:['TEST']},{id:2,headline:'Undated',symbols:['TEST']}]}:{results:[{id:'1',published_utc:timestamp,title:'Synthetic valid',tickers:['TEST']},{id:'2',title:'Undated',tickers:['TEST']}]});
   };
   const items=await fetchNews(['TEST']);assert.equal(items.length,1);assert.equal(items[0].timestamp,timestamp);assert.equal(requests,1);assert.equal(writes.length,1);
   const finished=receipts.at(-1);assert.equal(finished[0],'finished');assert.equal(finished[1],2);
   const details=JSON.parse(finished[3]);assert.equal(details.accepted,1);assert.equal(details.rejected[0].reason,'missing_source_timestamp');assert.equal(details.timestampPolicyVersion,'tradeos.provider-news-intake.v1');
  }
 }finally{
  globalThis.fetch=originalFetch;delete globalThis.__newsProviderSql;hooks.deregister();
  for(const [key,value] of Object.entries(keys)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
