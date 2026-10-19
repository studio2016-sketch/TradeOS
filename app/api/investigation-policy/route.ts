import {NextResponse} from "next/server";
import {investigationSafety} from "../../../lib/agents/investigations";
export const dynamic="force-dynamic";
export function GET(){
 return NextResponse.json({status:"policy_engine_ready",researchLifecycle:["unverified","investigating","challenged","testing","certification_review"],safety:investigationSafety,investigationsRunning:0,autonomousExecution:false},{headers:{"Cache-Control":"no-store"}});
}
