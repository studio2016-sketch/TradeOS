import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {graphFromResearch} from "../../../lib/research/financialGraph";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const params=new URL(req.url).searchParams;
 const symbol=(params.get("symbol")||"").trim().toUpperCase();
 if(symbol&&!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))return NextResponse.json({error:"Invalid stock symbol"},{status:400});
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",nodes:[],edges:[]},{status:503});
 try{
  const sql=db();
  const rows=await sql`
   select f.id,f.symbol,f.model_version,f.created_at,f.evidence,f.source_snapshot
   from forecast_ledger f where (${symbol}='' or f.symbol=${symbol})
   order by f.created_at desc limit 500
  `;
  const mapped=(rows as any[]).map(x=>{
   const evidence=Array.isArray(x.evidence)?x.evidence:[];
   const source=x.source_snapshot&&typeof x.source_snapshot==="object"?x.source_snapshot:{};
   return {symbol:String(x.symbol),modelVersion:String(x.model_version),forecastTime:new Date(x.created_at).toISOString(),
    sourceObservedAt:typeof source.observedAt==="string"?source.observedAt:null,
    source:typeof source.sourceId==="string"?source.sourceId:"forecast_ledger:source_unverified",
    factorLabels:evidence.filter((v:any)=>typeof v?.label==="string").map((v:any)=>String(v.label)),
    forecastId:String(x.id)};
  });
  return NextResponse.json({status:"RESEARCH_LINEAGE_ONLY",generatedAt:new Date().toISOString(),symbolFilter:symbol||null,
   ...graphFromResearch(mapped),certifiedCorporateRelationships:false,certifiedPredictiveRelationships:false},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",message:"Evidence graph unavailable"},{status:503})}
}
