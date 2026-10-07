import {NextResponse} from "next/server";
import {assess} from "../../../lib/market/assessment";
import {configuredSourceHealth} from "../../../lib/market/providers";
import type {Evidence} from "../../../lib/market/types";
export const dynamic="force-dynamic";
export async function GET(){
 const evidence:Evidence[]=[
  {id:"trend",label:"Trend structure",value:78,direction:"bullish",quality:.94,freshness:.98,independence:.9,sourceIds:["massive"],explanation:"Price structure remains constructive above key intraday references."},
  {id:"breadth",label:"Market breadth",value:61,direction:"bullish",quality:.88,freshness:.96,independence:.85,sourceIds:["massive"],explanation:"More constituents confirm the index move than reject it."},
  {id:"vol",label:"Volatility structure",value:54,direction:"bullish",quality:.92,freshness:.9,independence:.95,sourceIds:["cboe"],explanation:"Volatility structure is not signaling immediate systemic stress."},
  {id:"cross",label:"Cross-asset confirmation",value:35,direction:"mixed",quality:.84,freshness:.9,independence:1,sourceIds:["macro"],explanation:"Rates and dollar context do not fully confirm the equity signal."},
  {id:"catalyst",label:"Catalyst verification",value:73,direction:"bullish",quality:.98,freshness:.99,independence:.95,sourceIds:["sec","alpaca"],explanation:"Catalyst is corroborated by higher-trust sources."}
 ];
 return NextResponse.json({mode:"demo_until_credentials_are_configured",assessment:assess(evidence),sources:configuredSourceHealth(),generatedAt:new Date().toISOString()});
}
