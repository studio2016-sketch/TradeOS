/** One 105s budget inside a 120s function, leaving 15s for a sanitized response.
 * Aborting transport cannot prove a commit did not occur; callers must never auto-retry.
 */
export const DAILY_REQUEST_BUDGET_MS=105000;
export const DAILY_RUN_BUDGET_MS=90000;
export function dailyRequestBudget(now=()=>Date.now(),budgetMs=DAILY_REQUEST_BUDGET_MS){
 const started=now(),deadline=started+budgetMs,controller=new AbortController();let previous=started;
 const timer=setTimeout(()=>controller.abort(Error('daily_request_deadline')),budgetMs);
 const clock=()=>{const current=now();if(controller.signal.aborted||!Number.isFinite(current)||current<previous||current>=deadline)throw Error('daily_request_deadline');previous=current;return new Date(current);};
 return {signal:controller.signal,clock,
  requireRunBudget(){if(+clock()+DAILY_RUN_BUDGET_MS>deadline)throw Error('daily_request_start_budget');},
  sql(driver:any,readOnly=false){return async(s:TemplateStringsArray,...v:unknown[])=>{clock();const result=await driver.transaction([driver(s,...v)],{readOnly,fetchOptions:{signal:controller.signal}});clock();return result[0];};},
  async run<T>(work:()=>Promise<T>):Promise<T>{
   let abort!:()=>void;
   const stopped=new Promise<never>((_,reject)=>{abort=()=>reject(Error('daily_request_deadline'));controller.signal.addEventListener('abort',abort,{once:true});if(controller.signal.aborted)abort();});
   try{clock();return await Promise.race([work(),stopped]);}
   finally{controller.signal.removeEventListener('abort',abort);clearTimeout(timer);controller.abort();}
  },
 };
}
/** Size and time bounds apply to streamed bytes, not untrusted Content-Length. */
export async function dailyRequestText(req:Request,timeoutMs=2000){
 if(req.body===null)return '';
 if(req.bodyUsed||req.body.locked)throw Error('invalid_request_stream');
 const reader=req.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([(async()=>{
  const chunks:Uint8Array[]=[];let size=0;
  for(let count=0;count<1024;count++){const part=await reader.read();if(part.done){const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
   size+=part.value.byteLength;if(size>512)throw Error('request_too_large');chunks.push(part.value);
  }throw Error('invalid_request_stream');
 })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('request_body_timeout')),timeoutMs);})]);}
 finally{if(timer)clearTimeout(timer);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
