import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const receipts=new Map(input.external.map(article=>[article.id,article]));
let matched=0,missing=0,invalid=0;
for(const observation of input.evidence){
 for(const ref of observation.source_metadata.articleIds.filter(id=>id.startsWith('massive:'))){
  const article=receipts.get(ref.slice(8));
  if(!article){missing++;continue;}
  const published=Date.parse(article.published_utc);
  const observed=Date.parse(observation.observed_at);
  if(!Number.isFinite(published)||published>observed||!article.tickers.includes(observation.subject)){invalid++;continue;}
  matched++;
 }
}
console.log(JSON.stringify({matched,missing,invalid,certified:false}));
if(missing||invalid||matched===0)process.exitCode=1;
