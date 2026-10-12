import {NextResponse} from "next/server";
import {assess} from "../../../lib/market/assessment";
import {configuredSourceHealth} from "../../../lib/market/providers";
import type {Evidence} from "../../../lib/market/types";
import {observedMarketEvidence} from "../../../lib/market/observedAssessment";
export const dynamic="force-dynamic";
export async function GET(){
 const observed=await observedMarketEvidence().catch(()=>null);
 if(observed){
   return NextResponse.json({
     mode:"observed_market_data",
     assessment:assess(observed.evidence),
     sampleCount:observed.sampleCount,
     sources:configuredSourceHealth(),
     generatedAt:new Date().toISOString()
   });
 }
 const evidence:Evidence[]=[];
 const fallback=assess(evidence);
 return NextResponse.json({mode:"unavailable",assessment:{...fallback,confidence:0,uncertainty:100,decision:"pass",warnings:[...fallback.warnings,"Independent measured evidence unavailable; assessment remains PASS."]},sources:configuredSourceHealth(),generatedAt:new Date().toISOString()});
}
