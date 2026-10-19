import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(){
 const bucket=process.env.TRADEOS_RESEARCH_STORAGE_BUCKET;
 const endpoint=process.env.TRADEOS_RESEARCH_STORAGE_ENDPOINT;
 const region=process.env.TRADEOS_RESEARCH_STORAGE_REGION;
 const configured=Boolean(bucket&&endpoint&&region);
 let manifest=false;let artifactsRegistered:number|null=null;
 if(hasDatabase()){
  try{
   const sql=db();
   const found=await sql`select to_regclass('public.research_artifact_manifest') is not null as present`;
   manifest=found[0]?.present===true;
   if(manifest){const rows=await sql`select count(*)::int as total from research_artifact_manifest`;artifactsRegistered=Number(rows[0]?.total??0);}
  }catch{return NextResponse.json({status:"database_unavailable",configured,manifest:false,uploadsEnabled:false,privateBucketExpected:true},{status:503,headers:{"Cache-Control":"no-store"}});}
 }
 return NextResponse.json({status:configured&&manifest?"metadata_connected":"setup_incomplete",bucket:configured?bucket:null,region:configured?region:null,endpointConfigured:Boolean(endpoint),manifestReady:manifest,artifactsRegistered,uploadsEnabled:false,downloadsEnabled:false,privateBucketExpected:true,providerBucketVerifiedExternally:true,warning:"No authenticated object transfer gateway configured. Metadata readiness is not proof of upload or download connectivity."},{headers:{"Cache-Control":"no-store"}});
}
