/** Read-only diagnostic requests. Cancellation also guards transports that ignore abort. */
export function createPaperDiagnosticRequest(publish:(state:any)=>void,request:typeof fetch=fetch){
 let generation=0;
 let controller:AbortController|null=null;
 const cancel=()=>{generation++;controller?.abort();controller=null};
 const load=async(symbol:string)=>{
  cancel();
  const id=generation;
  const active=new AbortController();controller=active;
  const current=()=>generation===id&&!active.signal.aborted;
  publish({symbol,status:"loading"});
  try{
   const response=await request("/api/research-paper?symbol="+encodeURIComponent(symbol),{cache:"no-store",signal:active.signal});
   if(!current())return;
   if(!response.ok){publish({symbol,status:"unavailable",message:"Bridge returned "+response.status});return;}
   const result=await response.json();
   if(!current())return;
   if(!result||typeof result!=="object"||result.symbol!==symbol){
    publish({symbol,status:"unavailable",message:"Research response did not match the selected symbol"});return;
   }
   publish(result);
  }catch{if(current())publish({symbol,status:"unavailable",message:"Research bridge unreachable"})}
  finally{if(current())controller=null}
 };
 return{load,cancel};
}
