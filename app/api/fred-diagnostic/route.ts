import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
async function probe(url:string){
  const started=Date.now();
  try{
    const res=await fetch(url,{cache:"no-store"});
    return {url,status:res.status,ok:res.ok,ms:Date.now()-started,body:(await res.text()).slice(0,300)};
  }catch(error){
    return {url,status:null,ok:false,ms:Date.now()-started,error:error instanceof Error?error.message:String(error)};
  }
}
export async function GET(){
  const [api,graph]=await Promise.all([
    probe("https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&file_type=json"),
    probe("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10")
  ]);
  return NextResponse.json({api,graph,generatedAt:new Date().toISOString()});
}
