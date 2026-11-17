import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {projectDetailedAudit,runDetailedAudit,type AuditScope} from '../lib/operations/detailed-audit';
const graph=()=>({graph:{status:'INDEPENDENT_SOURCE_GRAPH_ACTIVE',certifiedPredictiveRelationships:false,corporateRelationships:[],independentGraph:{policy:{graphImpliesPrediction:false,sourceCountMeansIndependentOriginFamilies:true,minimumIndependentSourcesForCertification:2},edges:[{predictiveAuthority:false}]}},certification:{modelPromotionAllowed:false,liveExecutionAllowed:false},factors:{status:'RESEARCH_ONLY',certified:false,promotionAllowed:false}});
const models=()=>({model:{certification:'RESEARCH_ONLY_NOT_PROMOTED',validations:[{status:'INSUFFICIENT_EVIDENCE',sampleCount:1,evidenceOfImprovement:false}]},provenance:{certification:'BLOCKED_UNTIL_POINT_IN_TIME_SOURCE_AND_PAIRED_MODEL_EVIDENCE',audit:{}},trial:{status:'RESEARCH_ONLY',noAutomaticPromotion:true},factors:{status:'RESEARCH_ONLY',certified:false,promotionAllowed:false,associations:[{validated:false,recorded:1}]},simulation:{certification:'RESEARCH_ONLY',simulation:{mode:'HISTORICAL_PAPER_ONLY'}}});
const sources=()=>({extended:{checks:[{category:'news',source:'probe',status:'observed'},{category:'portfolio_metrics',source:'Alpaca account',status:'read_access_not_authorized'}]},market:{productionCertification:'NOT_CERTIFIED',snapshots:['SPY','QQQ','NVDA'].map(symbol=>({symbol,state:'recent_observation',pricePresent:true,exchangeRealtimeCertified:false})),barChecks:[{status:'historical_data',count:1},{status:'historical_data',count:1}]},monitoring:{market:{clockSource:'Alpaca Market Clock',isOpen:false,clockTimestamp:'2026-11-17T00:00:00Z',nextOpen:'2026-11-17T14:30:00Z'}}});
const pass=(scope:AuditScope,data:any)=>assert.ok(Object.values(projectDetailedAudit(scope,data).checks).every(x=>x==='PASS'));
test('valid research-only source/model/graph assertions pass without certification claim',()=>{
 pass('sources',sources());pass('models',models());pass('graph',graph());const legacy=graph();legacy.graph.status='RESEARCH_LINEAGE_ONLY';pass('graph',legacy);
});
test('graph authority, independence, provenance and factor regressions are detected',()=>{
 for(const mutate of [(v:any)=>v.graph.certifiedPredictiveRelationships=true,(v:any)=>v.graph.status='UNAVAILABLE',(v:any)=>delete v.graph.independentGraph,(v:any)=>v.graph.independentGraph.policy.minimumIndependentSourcesForCertification=1,(v:any)=>v.graph.independentGraph.edges[0].predictiveAuthority='false',(v:any)=>v.graph.corporateRelationships=[{sourceUrl:'x',publishedAt:'bad',verificationStatus:'observed'}],(v:any)=>v.certification.modelPromotionAllowed=true,(v:any)=>v.factors.promotionAllowed=true]){const v=graph();mutate(v);assert.ok(Object.values(projectDetailedAudit('graph',v).checks).includes('FAIL'));}
});
test('model and source contract drift fails; no empty missing probe can pass',()=>{
 const m=models();m.factors.associations[0].validated=true;assert.equal(projectDetailedAudit('models',m).checks.factorValidationNotClaimed,'FAIL');
 const s=sources();s.market.productionCertification='CERTIFIED';assert.equal(projectDetailedAudit('sources',s).checks.marketCertificationNotClaimed,'FAIL');
 for(const scope of ['sources','models','graph'] as const)assert.ok(Object.values(projectDetailedAudit(scope,{}).checks).every(x=>x==='UNAVAILABLE'));
});
test('private values and malicious extra fields never cross projection boundary',()=>{
 const raw:any=graph();raw.secret='SECRET-CANARY';raw.graph.privateEquity=123456789;raw.graph.modelName='SECRET-CANARY';raw.graph.independentGraph.edges[0].private='SECRET-CANARY';
 const output=JSON.stringify(projectDetailedAudit('graph',raw));assert.ok(!output.includes('SECRET-CANARY'));assert.ok(!output.includes('123456789'));
});
test('exceptions and deadlines return only unavailable checks',async()=>{
 for(const load of [async()=>{throw Error('SECRET-CANARY');},()=>new Promise<Record<string,unknown>>(()=>{})]){
  const r=await runDetailedAudit('models',load,2);assert.ok(Object.values(r.checks).every(x=>x==='UNAVAILABLE'));assert.ok(!JSON.stringify(r).includes('SECRET-CANARY'));
 }
});
test('owner APIs remain guarded while detailed audit loads only fixed internal helpers after authorization',()=>{
 for(const name of ['extended-source-audit','source-audit','monitoring-status','knowledge-graph','model-validation','forecast-provenance','prospective-trial','factor-lab','research-certification','replay-simulation']){
  const source=fs.readFileSync(`app/api/${name}/route.ts`,'utf8');assert.match(source,/GET=withPrivateRead\(privateGET\)/);assert.ok(!source.includes('authorizeRuntimeAudit'));
 }
 const route=fs.readFileSync('app/api/private-detailed-audit/route.ts','utf8');assert.ok(route.indexOf('if(status!==200)')<route.indexOf('await import('));assert.match(route,/params.size!==1/);assert.ok(!route.includes('fetch('));
 for(const name of ['extended-production-audit','knowledge-graph-production','model-runtime-audit']){const source=fs.readFileSync(`.github/workflows/${name}.yml`,'utf8');assert.ok(!source.includes('pull_request'));assert.ok(source.includes("github.ref == 'refs/heads/main'"));assert.ok(source.includes('id-token: write'));assert.ok(source.includes('run-private-oidc-audit.py'));assert.ok(!source.includes('secrets.'));assert.ok(!source.includes('json.dumps'));}
});
test('actual detailed endpoint denies before service loading and rejects arbitrary scopes',async()=>{
 const {createHash}=await import('node:crypto');const {GET}=await import('../app/api/private-detailed-audit/route');
 const token='ab'.repeat(32),before=process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;
 try{
  delete process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;assert.equal((await GET(new Request('https://audit.invalid/api/private-detailed-audit?scope=graph'))).status,503);
  process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=createHash('sha256').update(token).digest('hex');
  assert.equal((await GET(new Request('https://audit.invalid/api/private-detailed-audit?scope=graph'))).status,401);
  for(const query of ['', '?scope=private-portfolio','?scope=graph&scope=models','?scope=graph&url=https://evil.invalid']){
   const r=await GET(new Request('https://audit.invalid/api/private-detailed-audit'+query,{headers:{authorization:'Bearer '+token}}));assert.equal(r.status,400);assert.equal(r.headers.get('cache-control'),'private, no-store');
  }
 }finally{if(before===undefined)delete process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256;else process.env.TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256=before;}
});
test('coercible numeric dates cannot masquerade as source timestamps',()=>{
 const s:any=sources();s.monitoring.market.clockTimestamp=1;assert.equal(projectDetailedAudit('sources',s).checks.providerClockStructured,'FAIL');
 const g:any=graph();g.graph.corporateRelationships=[{sourceUrl:'https://example.invalid',verificationStatus:'observed',publishedAt:1}];assert.equal(projectDetailedAudit('graph',g).checks.corporateEvidenceProvenance,'FAIL');
});
test('missing source and research evidence remains visible without exposing counts',()=>{
 const s:any=sources();s.extended.checks=s.extended.checks.filter((x:any)=>x.category==='portfolio_metrics');s.market.snapshots.forEach((x:any)=>x.pricePresent=false);s.market.barChecks=[{status:'error',count:0},{status:'unavailable',count:0}];
 const sc=projectDetailedAudit('sources',s).checks;for(const key of ['sourceObservationsPresent','marketObservationsPresent','historicalBarsPresent'])assert.equal(sc[key],'UNAVAILABLE');assert.equal(sc.marketCertificationNotClaimed,'PASS');
 const m=models();m.model.validations=[];m.factors.associations=[];const mc=projectDetailedAudit('models',m).checks;assert.equal(mc.modelEvidencePresent,'UNAVAILABLE');assert.equal(mc.factorEvidencePresent,'UNAVAILABLE');assert.equal(mc.modelResearchOnly,'PASS');
});
