import {NextResponse} from "next/server";
import {auth} from "../../../lib/auth/server";
import {db,hasDatabase} from "../../../lib/db";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
async function owner(){
 const s=await auth.getSession();const id=s.data?.user?.id;
 if(!id||!hasDatabase())return null;
 const sql=db();const rows=await sql`select id::text,role,banned,"emailVerified" as verified from neon_auth."user" where id::text=${id} limit 1`;
 const u=rows[0];
 return u?.verified===true&&u.banned!==true&&u.role==="admin"&&Boolean(process.env.TRADEOS_OWNER_USER_ID)&&u.id===process.env.TRADEOS_OWNER_USER_ID?{id,sql}:null;
}
export async function GET(){
 try{
  const a=await owner();if(!a)return NextResponse.json({error:"Verified owner required"},{status:403,headers});
  const rows=await a.sql`select id::text,title,hypothesis,state,created_at from research_investigations where owner_id=${a.id} order by created_at desc limit 100`;
  return NextResponse.json({investigations:rows},{headers});
 }catch{return NextResponse.json({error:"Investigations unavailable"},{status:503,headers});}
}
export async function POST(request:Request){
 try{
  const a=await owner();if(!a)return NextResponse.json({error:"Verified owner required"},{status:403,headers});
  const b=await request.json();const title=String(b?.title??"").trim();const hypothesis=String(b?.hypothesis??"").trim();
  if(!title||title.length>160||!hypothesis||hypothesis.length>2500)return NextResponse.json({error:"Title and hypothesis required within length limits"},{status:400,headers});
  const rows=await a.sql`insert into research_investigations(owner_id,title,hypothesis) values(${a.id},${title},${hypothesis}) returning id::text,title,hypothesis,state,created_at`;
  return NextResponse.json({investigation:rows[0],certified:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Investigation could not be created"},{status:503,headers});}
}
