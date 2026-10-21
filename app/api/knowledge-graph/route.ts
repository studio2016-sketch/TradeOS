import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {graphFromResearch} from "../../../lib/research/financialGraph";
import {buildFinancialKnowledgeGraph} from "../../../lib/research/knowledgeGraph";
import {graphHypotheses} from "../../../lib/research/factorDiscovery";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const params=new URL(req.url).searchParams;
 const symbol=(params.get("symbol")||"").trim().toUpperCase();
 if(symbol&&!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol))return NextResponse.json({error:"Invalid stock symbol"},{status:400});
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",nodes:[],edges:[]},{status:503});
 try{
  const sql=db();
  const [rows,independentGraphResult]=await Promise.all([sql`
   select f.id,f.symbol,f.model_version,f.created_at,f.evidence,f.source_snapshot
   from forecast_ledger f where (${symbol}='' or f.symbol=${symbol})
   order by f.created_at desc limit 500
  `,buildFinancialKnowledgeGraph(symbol?[symbol]:["NVDA","AMD","AAPL","MSFT","SPY","QQQ","IWM"]).catch(()=>null)]);
  const mapped=(rows as any[]).map(x=>{
   const evidence=Array.isArray(x.evidence)?x.evidence:[];
   const source=x.source_snapshot&&typeof x.source_snapshot==="object"?x.source_snapshot:{};
   return {symbol:String(x.symbol),modelVersion:String(x.model_version),forecastTime:new Date(x.created_at).toISOString(),
    sourceObservedAt:typeof source.observedAt==="string"?source.observedAt:null,
    source:typeof source.sourceId==="string"?source.sourceId:"forecast_ledger:source_unverified",
    factorLabels:evidence.filter((v:any)=>typeof v?.label==="string").map((v:any)=>String(v.label)),
    forecastId:String(x.id)};
  });
  const graph=graphFromResearch(mapped);
  let corporateStatus:"AVAILABLE"|"UNAVAILABLE"="UNAVAILABLE";
  let corporateRelationships:any[]=[];
  try{
   const corporateRows=await sql`
    select id,subject_kind,subject_id,relation,object_kind,object_id,source_url,source_name,
     source_publication_at,source_observed_at,collected_at,verification_status
    from financial_relationship_evidence
    where (${symbol}='' or subject_id=${symbol} or object_id=${symbol})
    order by collected_at desc limit 300
   `;
   corporateStatus="AVAILABLE";
   corporateRelationships=(corporateRows as any[]).map(x=>({
    id:String(x.id),from:String(x.subject_kind)+":"+String(x.subject_id),
    to:String(x.object_kind)+":"+String(x.object_id),relation:String(x.relation),
    sourceName:String(x.source_name),sourceUrl:String(x.source_url),
    publishedAt:new Date(x.source_publication_at).toISOString(),
    sourceObservedAt:new Date(x.source_observed_at).toISOString(),
    collectedAt:new Date(x.collected_at).toISOString(),
    verificationStatus:String(x.verification_status)
   }));
  }catch{}
  const graphDerivedHypotheses=independentGraphResult?graphHypotheses(independentGraphResult):null;
  return NextResponse.json({status:independentGraphResult?"INDEPENDENT_SOURCE_GRAPH_ACTIVE":"RESEARCH_LINEAGE_ONLY",generatedAt:new Date().toISOString(),symbolFilter:symbol||null,
   ...graph,corporateStatus,corporateRelationships,
   independentGraph:independentGraphResult,
   graphDerivedHypotheses,
   certifiedCorporateRelationships:corporateRelationships.length>0&&corporateRelationships.every(x=>x.verificationStatus==="INDEPENDENTLY_VERIFIED"),
   certifiedPredictiveRelationships:false},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",message:"Evidence graph unavailable"},{status:503})}
}
