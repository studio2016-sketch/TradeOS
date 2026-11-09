import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='./news'&&context.parentURL?.endsWith('/lib/market/newsReaction.ts')||specifier==='./alpaca-data-fetch'&&context.parentURL?.endsWith('/lib/market/features.ts'))return nextResolve(new URL('./fixtures/news-reaction-transport.mjs',import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {latestNewsReaction}=await import('../lib/market/newsReaction.ts');hooks.deregister();
test('actual reaction-to-history HTTP path cannot sanitize away bad rows or ignore incomplete envelopes',async()=>{
 const old={ALPACA_API_KEY:process.env.ALPACA_API_KEY,ALPACA_API_SECRET:process.env.ALPACA_API_SECRET,ALPACA_FEED:process.env.ALPACA_FEED};
 process.env.ALPACA_API_KEY='fixture';process.env.ALPACA_API_SECRET='fixture';process.env.ALPACA_FEED='iex';
 const anchor=Math.floor(Date.now()/300000)*300000,at=minutes=>new Date(anchor+minutes*60000).toISOString();
 const bar=(minutes,c)=>({t:at(minutes),o:c,h:c+1,l:c-1,c,v:1});
 const good=[bar(-35,100),bar(-30,500),bar(-25,103),bar(0,999)];
 globalThis.__reactionArticles=[{id:'synthetic',timestamp:at(-28),symbols:['TEST'],headline:'Synthetic article',source:'Fixture'}];
 let response;
 globalThis.__reactionHistoryFetch=async(url)=>{
  assert.equal(new URL(url).searchParams.get('timeframe'),'5Min');assert.ok(new URL(url).searchParams.get('end'));
  return Response.json(response);
 };
 try{
  response={symbol:'TEST',bars:good,next_page_token:null};
  const valid=await latestNewsReaction('TEST');assert.equal(valid.matched,true);assert.equal(valid.returnPct,3);assert.equal(valid.measuredThrough,at(-20));
  const shared=await latestNewsReaction('TEST',[{...globalThis.__reactionArticles[0],id:'snapshot',headline:'Shared snapshot'}]);
  assert.equal(shared.headline,'Shared snapshot');assert.equal(shared.reactionEvidence.articleId,'snapshot');
  for(const invalid of [{...good[0],c:null},{...good[0],h:99},{...good[0],t:'2030-02-30T15:00:00Z'},good[0]]){
   response={symbol:'TEST',bars:[...good,invalid]};
   const rejected=await latestNewsReaction('TEST');assert.equal(rejected.matched,false);assert.equal(rejected.returnPct,null);
  }
  for(const invalid of [{symbol:'OTHER',bars:good},{symbol:'TEST',bars:good,feed:'sip'},{symbol:'TEST',bars:good,timeframe:'1Min'},{symbol:'TEST',bars:good,next_page_token:'more'},{symbol:'TEST',bars:good,error:'synthetic'},{}]){
   response=invalid;assert.equal((await latestNewsReaction('TEST')).matched,false);
  }
 }finally{
  delete globalThis.__reactionArticles;delete globalThis.__reactionHistoryFetch;
  for(const [key,value] of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
