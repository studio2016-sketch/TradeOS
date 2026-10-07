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
 const evidence:Evidence[]=[
  {id:"trend",label:"Trend structure",value:78,direction:"bullish",quality:.94,freshness:.98,independence:.9,sourceIds:["demo"],explanation:"Illustrative trend evidence used only until enough real observations exist."},
  {id:"breadth",label:"Market breadth",value:61,direction:"bullish",quality:.88,freshness:.96,independence:.85,sourceIds:["demo"],explanation:"Illustrative breadth evidence used only until enough real observations exist."},
  {id:"vol",label:"Volatility structure",value:54,direction:"neutral",quality:.7,freshness:.8,independence:.95,sourceIds:["demo"],explanation:"Illustrative volatility context; no live volatility feed is connected yet."}
 ];
 return NextResponse.json({mode:"fallback_demo",assessment:assess(evidence),sources:configuredSourceHealth(),generatedAt:new Date().toISOString()});
}
