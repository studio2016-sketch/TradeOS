/* Local synthetic-only transport. Loaded before React. No real fetch is retained. */
(() => {
  const mode=new URL(location.href).searchParams.get('scenario')||'empty';
  const timestamp='2026-11-17T12:00:00Z';
  const fixture=path=> {
    if(path==='/api/health')return {metrics:{observations:'12345',forecasts:'321'},reliability:{consolidatedRealtimeEquities:false,rows:[{id:'qa',label:'Synthetic QA source',freshness:'stale',decisionGrade:false}]}};
    if(path==='/api/market')return {snapshots:['NVDA','AMD','PLTR'].map((symbol,i)=>({symbol,price:123.45+i,timestamp,source:'SYNTHETIC QA ONLY'}))};
    if(path==='/api/alignment')return {canonical:{observedTotal:73,observedMarket:67,observedAdaptive:6},criticalPassed:3,criticalTotal:15,readings:[{id:'qa',label:'Synthetic unresolved factor',state:'unavailable',group:'QA',note:'Synthetic test only'}],groups:[]};
    return {};
  };
  Object.defineProperty(window,'fetch',{configurable:false,writable:false,value:async(input)=>{
    const raw=typeof input==='string'?input:input.url;
    const url=new URL(raw,location.href);
    if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))throw new Error('QA network disabled');
    if(mode==='error')throw new Error('Synthetic QA offline state');
    return new Response(JSON.stringify(mode==='fixture'?fixture(url.pathname):{}),{status:200,headers:{'Content-Type':'application/json'}});
  }});
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a'); if(!anchor)return;
    const url=new URL(anchor.href,location.href);
    if(url.hash&&url.pathname===location.pathname)return;
    event.preventDefault();
    document.getElementById('qa-status').textContent='Navigation blocked in isolated QA: '+url.pathname;
  },true);
  document.addEventListener('submit',event=>event.preventDefault(),true);
})();
// Defense in depth beyond CSP. No real transport handle is retained.
for(const name of ['XMLHttpRequest','WebSocket','EventSource'])Object.defineProperty(window,name,{configurable:false,writable:false,value:class{constructor(){throw Error('Synthetic fixture network disabled');}}});
Object.defineProperty(window,'open',{configurable:false,writable:false,value:()=>{throw Error('Synthetic fixture navigation disabled');}});
// Exclude auth/sign-out flows: they are not meaningful in a client-only fixture.
document.addEventListener('click',event=>{
 const button=event.target.closest?.('button');
 if(button&&/^sign\s*out$/i.test(button.textContent?.trim()||'')){
  event.preventDefault();event.stopImmediatePropagation();
  document.getElementById('qa-status').textContent='Sign-out is excluded from synthetic visual QA.';
 }
},true);
