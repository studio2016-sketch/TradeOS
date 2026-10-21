import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {alignmentVariables} from "../../../lib/alignment/registry";
import {evaluateFactorAssociation} from "../../../lib/research/factorIntelligence";
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
  const [pitRows,independentGraph]=await Promise.all([
   sql`with resolved as (
      select f.id as forecast_id,f.created_at as forecast_time,f.symbol,
             case when o.was_correct then 1 else 0 end::int as outcome
      from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
      where o.was_correct is not null and o.resolved_at>f.created_at
      order by f.created_at desc
      limit 1000
    )
    select r.forecast_id,r.forecast_time,r.symbol,r.outcome,
           e.factor_key,e.value,e.domain,e.subject,e.source_name,e.observed_at,e.available_at
    from resolved r
    join lateral (
      select distinct on (factor_key)
        factor_key,value,domain,subject,source_name,observed_at,available_at,id
      from tradeos_factor_evidence
      where observed_at<=r.forecast_time
        and available_at<=r.forecast_time
        and (subject=r.symbol or domain='macro')
      order by factor_key,available_at desc,id desc
    ) e on true
    order by r.forecast_time asc,r.forecast_id asc,e.factor_key asc`,
   buildFinancialKnowledgeGraph(symbols).catch(()=>null)
  ]);
  const records:{time:string;outcome:0|1;label:string;value:number}[]=[];
  const pairValues:{forecastId:string;label:string;value:number}[]=[];
  const sourceFamilies=new Set<string>(),factors=new Set<string>(),forecasts=new Set<string>();
  for(const row of pitRows as any[]){
   const value=Number(row.value);
   const time=new Date(row.forecast_time).toISOString();
   if(!Number.isFinite(value)||Date.parse(row.observed_at)>Date.parse(time)||Date.parse(row.available_at)>Date.parse(time))continue;
   const label=String(row.factor_key);
   records.push({time,outcome:Number(row.outcome) as 0|1,label,value});
   pairValues.push({forecastId:String(row.forecast_id),label,value});
   forecasts.add(String(row.forecast_id));factors.add(label);sourceFamilies.add(String(row.source_name));
  }
  const hypotheses=independentGraph?graphHypotheses(independentGraph):null;
  return NextResponse.json({
   status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),registryCount:registry.length,recordedFactors:registry,
   pointInTimeEvidence:{rows:records.length,forecasts:forecasts.size,factors:factors.size,sourceFamilies:sourceFamilies.size,rule:"observed_at <= forecast_time AND available_at <= forecast_time; symbol-specific evidence plus macro-domain evidence"},
   associations:evaluateFactorAssociation(records).map(x=>({...x,pointInTimeEvidence:true,warning:"Descriptive chronological association from evidence that was available by the original forecast time. Still not independently certified: instrument clustering, multiple-testing correction, prospective protocol freeze, source-time certification and cost realism remain required."})),
   factorDependence:factorRedundancyStudy(pairValues),
   graphSourceHealth:independentGraph?.sourceHealth??[],
   graphDerivedHypotheses:hypotheses?.hypotheses??[],graphPolicy:hypotheses?.policy??null,
   promotionAllowed:false,certified:false,
   knowledgeGraphEndpoint:"/api/knowledge-graph",
   warning:"Factor Lab now fails closed to persisted point-in-time evidence. No factor is promoted from descriptive association alone."
  },{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return NextResponse.json({status:"UNAVAILABLE",registryCount:registry.length,associations:[],error:"Point-in-time factor evidence could not be safely evaluated",reason:e instanceof Error?e.message:"unknown"},{status:503});
 }
}
