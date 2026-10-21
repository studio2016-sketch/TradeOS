import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {alignmentVariables} from "../../../lib/alignment/registry";
import {evaluateFactorAssociation} from "../../../lib/research/factorIntelligence";
import {certifyResearch} from "../../../lib/research/certificationAuthority";
import {factorRedundancyStudy} from "../../../lib/research/factorRedundancy";
import {buildFinancialKnowledgeGraph} from "../../../lib/research/knowledgeGraph";
import {graphHypotheses} from "../../../lib/research/factorDiscovery";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const registry=alignmentVariables.map(x=>({id:x.id,label:x.label,group:x.group,weight:x.weight,criticalBuy:Boolean(x.criticalBuy),hardSell:Boolean(x.hardSell),independentlyValidated:false}));
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",registry,associations:[],message:"No forecast ledger available"},{status:503});
 try{
  const sql=db();
  const params=new URL(req.url).searchParams;
  const symbols=(params.get("symbols")||"NVDA,AMD,AAPL,MSFT,SPY,QQQ,IWM").split(",").map(x=>x.trim().toUpperCase()).filter(x=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(x)).slice(0,12);
  const [rows,independentGraph]=await Promise.all([sql`
   select f.id as forecast_id,f.created_at as forecast_time,f.evidence as evidence,f.source_snapshot as source_snapshot,
   case when o.was_correct then 1 else 0 end::int as outcome
   from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
   where o.was_correct is not null and o.resolved_at>f.created_at
   order by f.created_at asc limit 5000
  `,buildFinancialKnowledgeGraph(symbols).catch(()=>null)]);
  const records:{time:string;outcome:0|1;label:string;value:number}[]=[];
  let eligible=0,datedSources=0;
  const pairValues:{forecastId:string;label:string;value:number}[]=[];
  for(const row of rows as any[]){
   const e=typeof row.evidence==="string"?JSON.parse(row.evidence):row.evidence;
   if(!Array.isArray(e))continue;
   eligible++;
   const snap=row.source_snapshot;
   if(snap&&typeof snap.observedAt==="string"&&Number.isFinite(Date.parse(snap.observedAt))&&Date.parse(snap.observedAt)<=Date.parse(row.forecast_time))datedSources++;
   for(const factor of e){
    if(typeof factor?.label!=="string"||factor.label.length>120)continue;
    const value=typeof factor.value==="boolean"?(factor.value?1:0):typeof factor.value==="number"?factor.value:null;
    if(value!==null&&Number.isFinite(value)){
      records.push({time:new Date(row.forecast_time).toISOString(),outcome:Number(row.outcome) as 0|1,label:factor.label,value});
      pairValues.push({forecastId:String(row.forecast_id),label:factor.label,value});
    }
   }
  }
  const hypotheses=independentGraph?graphHypotheses(independentGraph):null;
  return NextResponse.json({status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),registryCount:registry.length,recordedFactors:registry,forecastCount:(rows as any[]).length,forecastsWithEvidence:eligible,forecastsWithDatedSource:datedSources,sourceTimestampCoverage:eligible?datedSources/eligible:null,associations:evaluateFactorAssociation(records),factorDependence:factorRedundancyStudy(pairValues),graphSourceHealth:independentGraph?.sourceHealth??[],graphDerivedHypotheses:hypotheses?.hypotheses??[],graphPolicy:hypotheses?.policy??null,promotionAllowed:false,researchCertification:certifyResearch({total:(rows as any[]).length,immutableRecords:0,sourceTimeVerified:0,publicationTimeVerified:0,outOfSamplePaired:0,independentSessionDates:0,predictiveSkillLowerBound:null,costAdjustedReturnLowerBound:null,portfolioReconciled:false,executionSlippageValidated:false}),knowledgeGraphEndpoint:"/api/knowledge-graph",warning:"Graph relationships generate research hypotheses only. Forecast evidence labels and source counts cannot promote a factor without frozen held-out independent testing, multiple-comparison control and cost realism."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",registryCount:registry.length,associations:[],error:"Historical factor evidence could not be safely evaluated"},{status:503})}
}
