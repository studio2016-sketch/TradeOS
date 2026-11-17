import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {createHash} from 'node:crypto';
const hooks=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier.includes('/internal-audit-models/'))return nextResolve(new URL('./fixtures/detailed-audit-services.mjs?name='+specifier.split('/').at(-1),import.meta.url).href,context);
 return nextResolve(specifier,context);
}});
const {GET}=await import('../app/api/private-detailed-audit/route.ts');
const token='ab'.repeat(32);
const request=scope=>new Request('https://audit.invalid/api/private-detailed-audit?scope='+scope,{headers:{authorization:'Bearer '+token}});
const fixtures=()=>({
 'extended-source-audit':{checks:[{category:'news',source:'probe',status:'observed'},{category:'portfolio_metrics',source:'Alpaca',status:'read_access_not_authorized'}]},
 'source-audit':{productionCertification:'NOT_CERTIFIED',snapshots:['SPY','QQQ','NVDA'].map(symbol=>({symbol,state:'recent_observation',pricePresent:true,exchangeRealtimeCertified:false})),barChecks:[{status:'historical_data',count:1},{status:'historical_data',count:1}]},
 'monitoring-status':{market:{clockSource:'Alpaca Market Clock',isOpen:false,clockTimestamp:'2026-11-17T00:00:00Z',nextOpen:'2026-11-17T14:30:00Z'}},
 'knowledge-graph':{status:'INDEPENDENT_SOURCE_GRAPH_ACTIVE',certifiedPredictiveRelationships:false,corporateRelationships:[],independentGraph:{policy:{graphImpliesPrediction:false,sourceCountMeansIndependentOriginFamilies:true,minimumIndependentSourcesForCertification:2},edges:[{predictiveAuthority:false}]}},
 'research-certification':{modelPromotionAllowed:false,liveExecutionAllowed:false},
 'factor-lab':{status:'RESEARCH_ONLY',certified:false,promotionAllowed:false,associations:[{validated:false,recorded:1}]},
 'model-validation':{certification:'RESEARCH_ONLY_NOT_PROMOTED',validations:[{status:'INSUFFICIENT_EVIDENCE',sampleCount:1,evidenceOfImprovement:false}]},
 'forecast-provenance':{certification:'BLOCKED_UNTIL_POINT_IN_TIME_SOURCE_AND_PAIRED_MODEL_EVIDENCE',audit:{}},
 'prospective-trial':{status:'RESEARCH_ONLY',noAutomaticPromotion:true},
 'replay-simulation':{certification:'RESEARCH_ONLY',simulation:{mode:'HISTORICAL_PAPER_ONLY'}}
});
test('actual authorized detailed route projects all scopes without raw payload leakage and fails closed on probe errors',async()=>{
 const previous=process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=createHash('sha256').update(token).digest('hex');
 try{
  for(const scope of ['sources','models','graph']){
   globalThis.__detailedCalls=[];globalThis.__detailedFixtures=fixtures();
   for(const value of Object.values(globalThis.__detailedFixtures)){value.private='SECRET-CANARY';value.equity=987654321;}
   const response=await GET(request(scope));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
   const text=await response.text();assert.ok(!text.includes('SECRET-CANARY'));assert.ok(!text.includes('987654321'));const body=JSON.parse(text);
   assert.deepEqual(Object.keys(body).sort(),['assurance','checks','scope','version']);assert.equal(body.scope,scope);assert.ok(Object.values(body.checks).every(x=>x==='PASS'));assert.equal(globalThis.__detailedCalls.length,scope==='models'?5:3);
   assert.ok(globalThis.__detailedCalls.every(x=>!x.url||x.url.startsWith('https://internal.invalid/')));
  }
  globalThis.__detailedFixtures=fixtures();globalThis.__detailedFixtures['model-validation']=Error('SECRET-CANARY');
  const failed=await GET(request('models'));assert.equal(failed.status,503);const body=await failed.json();assert.equal(body.checks.modelResearchOnly,'UNAVAILABLE');assert.ok(!JSON.stringify(body).includes('SECRET-CANARY'));
  globalThis.__detailedFixtures=fixtures();globalThis.__detailedFixtures['research-certification'].liveExecutionAllowed=true;
  const unsafe=await GET(request('graph'));assert.equal(unsafe.status,503);assert.equal((await unsafe.json()).checks.scientificPromotionDenied,'FAIL');
 }finally{hooks.deregister();delete globalThis.__detailedCalls;delete globalThis.__detailedFixtures;if(previous===undefined)delete process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;else process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=previous;}
});
