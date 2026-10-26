import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

// External receipts must be obtained independently from an authorized provider.
// A matching receipt does not establish entitlement or source-time certification.
export function reconcile(input) {
 const receipts=new Map((input.external||[]).filter(a=>typeof a.id==='string').map(a=>[a.id,a]));
 const counts={matched:0,missing:0,invalid:0};
 for(const observation of input.evidence||[]) {
  const ids=observation.source_metadata?.articleIds;
  if(!Array.isArray(ids)){counts.invalid++;continue;}
  for(const ref of ids.filter(id=>typeof id==='string'&&id.startsWith('massive:'))) {
   const article=receipts.get(ref.slice(8));
   if(!article){counts.missing++;continue;}
   const published=Date.parse(article.published_utc);
   const observed=Date.parse(observation.observed_at);
   if(!Number.isFinite(published)||!Number.isFinite(observed)||published>observed||
      !Array.isArray(article.tickers)||!article.tickers.includes(observation.subject)||
      typeof article.article_url!=='string'||!article.article_url.startsWith('https://')||
      typeof article.publisher?.name!=='string'||!article.publisher.name.trim()){
     counts.invalid++;continue;
   }
   counts.matched++;
  }
 }
 return {counts,certified:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const result=reconcile(input);
 console.log(JSON.stringify(result));
 if(!result.counts.matched||result.counts.missing||result.counts.invalid)process.exitCode=1;
}
