// Fetch independently sourced Massive news records for offline reconciliation.
// Usage: MASSIVE_API_KEY=... node scripts/research/fetch-massive-news.mjs NVDA 2026-10-25 2026-10-26
// The output contains external receipts only; never grants factor certification.
const [,,ticker,from,to]=process.argv;
if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker||'')||
   !/^\d{4}-\d{2}-\d{2}$/.test(from||'')||
   !/^\d{4}-\d{2}-\d{2}$/.test(to||'')) {
 console.error('Usage: node fetch-massive-news.mjs TICKER YYYY-MM-DD YYYY-MM-DD');
 process.exit(2);
}
const key=process.env.MASSIVE_API_KEY;
if(!key){console.error('MASSIVE_API_KEY unavailable');process.exit(2);}
const url=new URL('https://api.massive.com/v2/reference/news');
url.searchParams.set('ticker',ticker);
url.searchParams.set('published_utc.gte',from);
url.searchParams.set('published_utc.lte',to);
url.searchParams.set('limit','1000');
const receipts=[];
let next=url.toString();
for(let page=0;next&&page<20;page++){
 const endpoint=new URL(next);
 if(endpoint.origin!=='https://api.massive.com')throw Error('Unexpected pagination host');
 const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Provider response '+response.status);
 const body=await response.json();
 if(!Array.isArray(body.results))throw Error('Provider returned no results array');
 receipts.push(...body.results);
 next=body.next_url||null;
}
if(next)throw Error('Pagination incomplete');
console.log(JSON.stringify({ticker,from,to,external:receipts,certified:false}));
