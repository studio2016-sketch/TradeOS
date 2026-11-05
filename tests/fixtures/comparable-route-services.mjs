export const NextResponse={json:(data,init)=>new Response(JSON.stringify(data),{...init,headers:{'content-type':'application/json',...init?.headers}})};
export const auth={getSession:async()=>({data:{user:{id:'test-owner'}}})};
export const hasDatabase=()=>true;
export const db=()=>globalThis.__comparableSql;
export const evaluatePredictionOutcomeRow=()=>{throw Error('Unexpected outcome row in pairing-only fixture');};
export const summarizePredictionOutcomeEntries=()=>({total:0,independentlyCertified:false});
