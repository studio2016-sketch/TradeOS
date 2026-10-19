import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";
export async function GET(){
 if(!hasDatabase())return NextResponse.json({status:"unconfigured",writable:false});
 try{
  const sql=db();
  await sql`select 1 from agent_research_hypotheses limit 0`;
  return NextResponse.json({status:"schema_ready",writable:false},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({status:"migration_pending",records:[],writable:false},{headers:{"Cache-Control":"no-store"}});
 }
}
