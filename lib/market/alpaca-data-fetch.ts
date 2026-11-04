import {createHash} from "node:crypto";

/** Best-effort protection within one server process, not an account-wide quota.
 * Only in-flight GETs are shared. Successful responses are never cached, and a
 * cooldown returns 429 rather than passing old observations off as fresh data.
 * Callers use server-owned timeouts: a shared GET follows its first timeout,
 * not each joiner’s signal. Different time windows remain different requests.
 */
export function createAlpacaDataFetch(transport:typeof fetch = (...args)=>fetch(...args), now:()=>number = Date.now){
  const pending=new Map<string,Promise<Response>>();
  const cooldowns=new Map<string,number>();
  const fallbackMs=30_000;
  return async function alpacaDataFetch(url:URL, init:RequestInit={}):Promise<Response>{
    if(url.origin!=="https://data.alpaca.markets"||(init.method&&init.method!=="GET")){
      throw new Error("Alpaca data transport only supports market-data GET requests");
    }
    const headers=new Headers(init.headers);
    // Hash credentials so neither secrets nor account identifiers become map keys.
    const account=createHash("sha256").update(JSON.stringify([
      headers.get("APCA-API-KEY-ID"),headers.get("APCA-API-SECRET-KEY")
    ])).digest("hex");
    const time=now();
    for(const [key,until] of cooldowns)if(until<=time)cooldowns.delete(key);
    const until=cooldowns.get(account)??0;
    if(until>time)return Response.json({message:"Alpaca HTTP 429: waiting for provider rate-limit reset"},{status:429,headers:{
      "Retry-After":String(Math.ceil((until-time)/1000)),
      "X-RateLimit-Reset":String(Math.ceil(until/1000)),
      "X-TradeOS-Rate-Limit-Source":"local-cooldown"
    }});
    const requestKey=account+":"+url.toString();
    const existing=pending.get(requestKey);
    if(existing)return (await existing).clone();
    const request=(async()=>{
      const response=await transport(url,{...init,cache:"no-store"});
      if(response.status===429){
        const observed=now();
        const retry=response.headers.get("retry-after");
        const numeric=retry!==null&&/^\d+(?:\.\d+)?$/.test(retry.trim())?Number(retry):NaN;
        const retryAt=Number.isFinite(numeric)?observed+numeric*1000:retry?Date.parse(retry):NaN;
        const resetHeader=response.headers.get("x-ratelimit-reset");
        const reset=resetHeader!==null?Number(resetHeader)*1000:NaN;
        const deadlines=[retryAt,reset].filter(n=>Number.isFinite(n)&&n>observed);
        const deadline=deadlines.length?Math.max(...deadlines):observed+fallbackMs;
        // Bound memory in long-lived processes; this application normally uses one account.
        if(!cooldowns.has(account)&&cooldowns.size>=16)cooldowns.delete(cooldowns.keys().next().value!);
        cooldowns.set(account,Math.max(cooldowns.get(account)??0,deadline));
      }
      return response;
    })();
    // High-cardinality traffic cannot grow the coalescing registry without bound.
    const tracked=pending.size<64;
    if(tracked)pending.set(requestKey,request);
    try{return (await request).clone()}
    finally{if(tracked&&pending.get(requestKey)===request)pending.delete(requestKey)}
  };
}

export const alpacaDataFetch=createAlpacaDataFetch();
