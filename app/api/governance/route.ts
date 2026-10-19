import {NextResponse} from "next/server";
import {hasDatabase} from "../../../lib/db";
import {buildFinancialKnowledgeGraph} from "../../../lib/research/knowledgeGraph";
import {graphHypotheses} from "../../../lib/research/factorDiscovery";
import {certifyFactor,certifiedModelVersions} from "../../../lib/research/certification";
import {championChallengerEvaluation} from "../../../lib/research/championChallenger";
import {alpacaBrokerReconciliation} from "../../../lib/broker/alpaca";
import {verifyOpenMarketAdvancement} from "../../../lib/market/verification";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  if(!hasDatabase())return NextResponse.json({status:"database_unconfigured"},{status:503});
  const {searchParams}=new URL(req.url);
  const symbols=(searchParams.get("symbols")||"NVDA,AMD,PLTR,SPY,QQQ,IWM").split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
  const errors:any[]=[];
  let graph:any=null,factors:any=null,certifications:any[]=[],models:any[]=[],competition:any=null,brokerage:any=null,marketVerification:any=null;
  try{
    graph=await buildFinancialKnowledgeGraph(symbols);
    factors=graphHypotheses(graph);
    certifications=await Promise.all(factors.hypotheses.slice(0,40).map((h:any)=>certifyFactor(h)));
  }catch(error){errors.push({stage:"graph-factor-certification",error:error instanceof Error?error.message:String(error)});}
  try{models=await certifiedModelVersions();}catch(error){errors.push({stage:"model-certification",error:error instanceof Error?error.message:String(error)});}
  try{competition=await championChallengerEvaluation();}catch(error){errors.push({stage:"champion-challenger",error:error instanceof Error?error.message:String(error)});}
  try{brokerage=await alpacaBrokerReconciliation();}catch(error){errors.push({stage:"brokerage-reconciliation",error:error instanceof Error?error.message:String(error)});}
  try{marketVerification=await verifyOpenMarketAdvancement(["SPY","QQQ","NVDA"]);}catch(error){errors.push({stage:"market-verification",error:error instanceof Error?error.message:String(error)});}
  return NextResponse.json({
    status:errors.length?"degraded":"ok",
    graph:graph?{generatedAt:graph.generatedAt,stats:graph.stats,nodes:graph.nodes,edges:graph.edges}:null,
    factorDiscovery:factors,
    certification:{
      factorDecisions:certifications,
      certifiedFactors:certifications.filter(x=>x.modelEligible).length,
      modelDecisions:models,
      certifiedModels:models.filter((x:any)=>x.modelEligible).length,
      enforcement:"Only CERTIFIED findings/models are model-eligible. Graph presence, backtest quality, and challenger leadership alone do not grant analytical-model authority."
    },
    championChallenger:competition,
    brokerage,
    marketVerification,
    safety:{liveExecutionEnabled:false,researchCanPlaceOrders:false},
    errors,generatedAt:new Date().toISOString()
  });
}
