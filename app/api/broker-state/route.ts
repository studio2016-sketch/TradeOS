import {NextResponse} from "next/server";
import {alpacaBrokerState,brokerReadStatus} from "../../../lib/broker/alpaca";
export const dynamic="force-dynamic";
export async function GET(){
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
