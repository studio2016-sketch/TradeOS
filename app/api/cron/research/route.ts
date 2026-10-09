import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {DEFAULT_RESEARCH_UNIVERSE,discoverResearchSubjects} from "../../../../lib/research/subjectDiscovery";
import {persistResearchSnapshot,resolveResearchSubjects,researchScorecard,resolveExpertViews,expertScorecard} from "../../../../lib/research/ledger";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
  if(!hasDatabase())return NextResponse.json({error:"database_unconfigured"},{status:503});
  const configured=(process.env.TRADEOS_RESEARCH_UNIVERSE||"").split(",").map(s=>s.trim().toUpperCase()).filter(Boolean);
  const universe=configured.length?configured:DEFAULT_RESEARCH_UNIVERSE;
  const buckets=Math.max(1,Math.min(6,Number(process.env.TRADEOS_RESEARCH_BUCKETS||4)));
  const bucket=new Date().getUTCHours()%buckets;
  const symbols=universe.filter((_,i)=>i%buckets===bucket);
  const startedAt=new Date().toISOString();
  const errors:any[]=[];
  let snapshot:any=null,persisted:any=null,resolution:any=null,expertResolution:any=null,scorecard:any=null,expertScores:any=null;
  try{
    snapshot=await discoverResearchSubjects(symbols);
    persisted=await persistResearchSnapshot({...snapshot,researchUniverseSize:universe.length,bucket,buckets});
  }catch(error){errors.push({stage:"discovery",error:error instanceof Error?error.message:String(error)});}
  try{resolution=await resolveResearchSubjects(18);}catch(error){errors.push({stage:"resolution",error:error instanceof Error?error.message:String(error)});}
  try{expertResolution=await resolveExpertViews(24);}catch(error){errors.push({stage:"expert-resolution",error:error instanceof Error?error.message:String(error)});}\n  try{scorecard=await researchScorecard(90);}catch(error){errors.push({stage:"scorecard",error:error instanceof Error?error.message:String(error)});}\n  try{expertScores=await expertScorecard(90);}catch(error){errors.push({stage:"expert-scorecard",error:error instanceof Error?error.message:String(error)});}
  return NextResponse.json({
    status:errors.length?"degraded":"ok",
    startedAt,finishedAt:new Date().toISOString(),bucket,buckets,symbols,
    discovered:snapshot?{subjects:snapshot.subjects?.length??0,expertViews:snapshot.experts?.length??0,news:snapshot.newsCount??0,profiles:snapshot.profileCount??0,geography:{
      local:snapshot.geography?.localItems?.length??0,
      usDomestic:snapshot.geography?.usDomesticItems?.length??0,
      global:snapshot.geography?.globalItems?.length??0,
      localConfigured:Boolean(snapshot.geography?.configuredLocalTerms?.length)
    }}:null,
    persisted,resolution,expertResolution,scorecard,expertScores,errors,
    safety:{executionEligible:false,ordersAllowed:false,mode:"shadow-research-only"}
  });
}
