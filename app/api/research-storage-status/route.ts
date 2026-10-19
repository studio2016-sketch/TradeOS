import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {storageSigningReady} from "../../../lib/storage/signed-transfer";
export const dynamic="force-dynamic";
export async function GET(){
 const bucket=process.env.TRADEOS_RESEARCH_STORAGE_BUCKET;
 const endpoint=process.env.TRADEOS_RESEARCH_STORAGE_ENDPOINT;
 const region=process.env.TRADEOS_RESEARCH_STORAGE_REGION;
 const configured=Boolean(bucket&&endpoint&&region);
 const signingConfigured=storageSigningReady();
 let manifest=false;let artifactsRegistered:number|null=null;let registeredBytes:number|null=null;
 if(hasDatabase()){
  try{
   const sql=db();
   const found=await sql`select to_regclass('public.research_artifact_manifest') is not null as present`;
   manifest=found[0]?.present===true;
   if(manifest){const rows=await sql`select count(*)::int as total, coalesce(sum(byte_size),0)::text as bytes from research_artifact_manifest`;artifactsRegistered=Number(rows[0]?.total??0);registeredBytes=Number(rows[0]?.bytes??0);}
  }catch{return NextResponse.json({status:"database_unavailable",configured,manifest:false,uploadsEnabled:false,privateBucketExpected:true},{status:503,headers:{"Cache-Control":"no-store"}});}
 }
 return NextResponse.json({status:configured&&manifest?"metadata_connected":"setup_incomplete",bucket:configured?bucket:null,region:configured?region:null,endpointConfigured:Boolean(endpoint),manifestReady:manifest,artifactsRegistered,registeredBytes,usageScope:"Registered metadata only; excludes unregistered object bytes, actual provider usage, and billing.",uploadsEnabled:configured&&manifest&&signingConfigured,downloadsEnabled:configured&&manifest&&signingConfigured,transferAccess:"Verified owner authorization required",privateBucketExpected:true,providerBucketVerifiedExternally:true,warning:"These flags indicate configured authenticated transfer paths, not a live provider health check. Research certification requires independent evidence validation."},{headers:{"Cache-Control":"no-store"}});
}
