import {NextResponse} from "next/server";
import {assessOpportunity} from "../../../lib/decisions/opportunity";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const body=await request.json();
  if(!body||JSON.stringify(body).length>5000)return NextResponse.json({error:"Invalid assessment"},{status:400});
  const result=assessOpportunity(body);
  return NextResponse.json({...result,source:"user_supplied_scenario",liveMarketData:false,disclaimer:"Exploratory educational assessment; not a trade instruction."},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Unable to assess scenario"},{status:400});}
}
