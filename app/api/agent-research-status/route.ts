import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"unconfigured",records:[],writable:false});
 try{
  const sql=db();
  const records=await sql`select id,hypothesis,source_url,status,created_at from agent_research_hypotheses order by created_at desc limit 50`;
  return NextResponse.json({status:"available",records,writable:false},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({status:"migration_pending",records:[],writable:false},{headers:{"Cache-Control":"no-store"}});
 }
}
