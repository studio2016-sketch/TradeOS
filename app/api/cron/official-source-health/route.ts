import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {beaContext,eiaContext} from "../../../../lib/market/freeOfficial";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sources=await Promise.allSettled([beaContext(),eiaContext()]);
 const sql=db(),results=[];
 for(let i=0;i<sources.length;i++){
  const result=sources[i];
  const id=i===0?"bea":"eia";
  const info=result.status==="fulfilled"?{status:result.value.status,generatedAt:result.value.generatedAt,rows:Array.isArray(result.value.data)?result.value.data.length:0,note:result.value.note,error:result.value.error??null}:{status:"error",error:"source_adapter_failed"};
  await sql`insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
    values('official_source_health','research',${id},'official-source-health-v1',${JSON.stringify(info)}::jsonb)`;
  results.push({source:id,...info});
 }
 return NextResponse.json({results,verifiedFactorMeasurementsAdded:0,note:"BEA and EIA provider-health checks only. No unvalidated economic fields counted as 120-factor measurements.",ordersAllowed:false},{headers:{"Cache-Control":"no-store"}});
}
