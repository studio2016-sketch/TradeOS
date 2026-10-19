import {NextResponse} from "next/server";
import {externalAgents,internalAgents,agentNetworkPolicy} from "../../../lib/agents/network";
export const dynamic="force-dynamic";
export async function GET(){
 return NextResponse.json({status:"foundation_ready",external:{share:50,agents:externalAgents,connected:0,verifiedClaims:0},internal:{share:50,agents:internalAgents},policy:agentNetworkPolicy,researchOnly:true,generatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
}
