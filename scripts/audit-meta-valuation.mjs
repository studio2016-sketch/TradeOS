// Read-only replay of newly captured official SEC and TradeOS provider responses.
// Uses production selection, share review, ratio calculation and evidence gate.
// Never downloads, mutates the database, certifies, or backdates availability.
import {registerHooks} from 'node:module';
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const [directory,output]=process.argv.slice(2);
if(!directory||!output)throw new Error('Usage: node --import tsx scripts/audit-meta-valuation.mjs <fresh-capture-directory> <output.json>');
const startedAt=new Date().toISOString();
const inputHashes={},inputReceivedAt={};
function read(name){const path=join(directory,name),data=readFileSync(path);const age=Date.parse(startedAt)-statSync(path).mtimeMs;if(age<0||age>3600000)throw new Error('Capture outside fresh audit window: '+name);inputHashes[name]=createHash('sha256').update(data).digest('hex');inputReceivedAt[name]=statSync(path).mtime.toISOString();return data;}
const marketRaw=read('meta-market.json'),market=JSON.parse(marketRaw);
if(market.mode!=='provider_data'||market.snapshots?.length!==1||market.snapshots[0].symbol!=='META')throw new Error('Invalid provider capture');
if(Date.parse(market.generatedAt)>Date.parse(startedAt)||Date.parse(startedAt)-Date.parse(market.generatedAt)>3600000)throw new Error('Provider capture is not fresh');
globalThis.__metaAuditMarket=market;
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 const url=String(input);
 let file;
 if(url==='https://www.sec.gov/files/company_tickers.json')file='sec-tickers.json';
 else if(url==='https://data.sec.gov/api/xbrl/companyfacts/CIK0001326801.json')file='meta-facts.json';
 else if(url==='https://data.sec.gov/submissions/CIK0001326801.json')file='meta-sub.json';
 else if(url==='https://www.sec.gov/Archives/edgar/data/1326801/000162828026066773/meta-20260930.htm')file='meta.htm';
 else {
  const match=/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1326801\/(\d{18})\/[^/]+$/.exec(url);
  if(match){const a=match[1];file='review/'+a.slice(0,10)+'-'+a.slice(10,12)+'-'+a.slice(12);}
 }
 if(!file)throw new Error('Uncaptured source URL');
 return new Response(read(file),{status:200});
};
const hooks=registerHooks({resolve(specifier,context,next){
 if(['../db','../market/live'].includes(specifier)&&context.parentURL?.endsWith('/lib/research/sec-ratio-evidence.ts'))return next(new URL('./meta-capture-adapter.mjs',import.meta.url).href,context);
 return next(specifier,context);
}});
try{
 const {secRatioEvidenceWithDiagnostics}=await import('../lib/research/sec-ratio-evidence.ts');
 const {validateEvidence}=await import('../lib/research/evidence-gate.ts');
 const result=await secRatioEvidenceWithDiagnostics('META',new Date(startedAt));
 const evidence=result.evidence.map(item=>({...item,domain:'stock',metadata:{...item.metadata,inputMode:'fresh_source_capture_replay',inputHashes,inputReceivedAt,marketCaptureGeneratedAt:market.generatedAt,providerDecisionCertification:market.snapshots[0].certifiedDecisionEligible??false}}));
 const gates=evidence.map(item=>({factor:item.factor,...validateEvidence(item)}));
 if(gates.some(g=>!g.accepted))throw new Error('Evidence gate rejected collected candidates');
 const report={startedAt,completedAt:new Date().toISOString(),evidence,diagnostics:result.diagnostics,gates,certified:false,ordersAllowed:false};
 writeFileSync(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify({evidence:evidence.map(e=>({factor:e.factor,value:e.value})),diagnostics:result.diagnostics.map(d=>({stage:d.stage,reason:d.reason})),accepted:gates.length,certified:false,ordersAllowed:false},null,2));
}finally{hooks.deregister();globalThis.fetch=originalFetch;delete globalThis.__metaAuditMarket;}
