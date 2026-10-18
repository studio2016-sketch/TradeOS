import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {alignmentVariables} from "../../../lib/alignment/registry";
import {evaluateFactorAssociation} from "../../../lib/research/factorIntelligence";
export const dynamic="force-dynamic";
export async function GET(){
 const registry=alignmentVariables.map(x=>({id:x.id,label:x.label,group:x.group,weight:x.weight,criticalBuy:Boolean(x.criticalBuy),hardSell:Boolean(x.hardSell),independentlyValidated:false}));
 if(!hasDatabase())return NextResponse.json({status:"UNAVAILABLE",registry,associations:[],message:"No forecast ledger available"},{status:503});
 try{
  const sql=db();
  const rows=await sql`
   select f.created_at as forecast_time,f.evidence as evidence,
   case when o.was_correct then 1 else 0 end::int as outcome
   from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id
   where o.was_correct is not null and o.resolved_at>f.created_at
   order by f.created_at asc limit 5000
  `;
  const records:{time:string;outcome:0|1;label:string;value:number}[]=[];
  let eligible=0;
  for(const row of rows as any[]){
   const e=typeof row.evidence==="string"?JSON.parse(row.evidence):row.evidence;
   if(!Array.isArray(e))continue;
   eligible++;
   for(const factor of e){
    if(typeof factor?.label!=="string"||factor.label.length>120)continue;
    const value=typeof factor.value==="boolean"?(factor.value?1:0):typeof factor.value==="number"?factor.value:null;
    if(value!==null&&Number.isFinite(value))records.push({time:new Date(row.forecast_time).toISOString(),outcome:Number(row.outcome) as 0|1,label:factor.label,value});
   }
  }
  return NextResponse.json({status:"RESEARCH_ONLY",generatedAt:new Date().toISOString(),registryCount:registry.length,recordedFactors:registry,forecastCount:(rows as any[]).length,forecastsWithEvidence:eligible,associations:evaluateFactorAssociation(records),promotionAllowed:false,warning:"These forecast evidence labels do not establish independent point-in-time histories for all registry gears. Associations cannot be promoted to predictive factors without frozen held-out independent testing, multiple-comparison control and cost realism."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"UNAVAILABLE",registryCount:registry.length,associations:[],error:"Historical factor evidence could not be safely evaluated"},{status:503})}
}
