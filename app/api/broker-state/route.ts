import {NextResponse} from "next/server";
import {alpacaBrokerState,brokerReadStatus} from "../../../lib/broker/alpaca";
import {authorizeIngest} from "../../../lib/security";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  if(!authorizeIngest(req))return NextResponse.json({mode:"authorization_required",state:null,error:"Private portfolio state requires administrator authorization."},{status:401,headers:{"Cache-Control":"private, no-store"}});
  const status=brokerReadStatus();
  if(!status.enabled)return NextResponse.json({mode:"approval_required",status,state:null});
  if(!status.environment)return NextResponse.json({mode:"environment_required",status,state:null});
  try{
    const state=await alpacaBrokerState();
    return NextResponse.json({mode:state?"read_only_connected":"unavailable",status,state});
  }catch(error){
    return NextResponse.json({mode:"degraded",status,state:null,error:error instanceof Error?error.message:String(error)},{status:502});
  }
}
