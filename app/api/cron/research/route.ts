import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {hasDatabase} from "../../../../lib/db";
import {DEFAULT_RESEARCH_UNIVERSE,discoverResearchSubjects} from "../../../../lib/research/subjectDiscovery";
import {freeOfficialSnapshot} from "../../../../lib/market/freeOfficial";
import {db} from "../../../../lib/db";
import {persistResearchSnapshot,resolveResearchSubjects,researchScorecard,resolveExpertViews,expertScorecard,resolveInstitutionalPlaybooks,institutionalPlaybookScorecard} from "../../../../lib/research/ledger";
import {buildFinancialKnowledgeGraph} from "../../../../lib/research/knowledgeGraph";
import {graphHypotheses} from "../../../../lib/research/factorDiscovery";
import {resolveDecisionMemory,decisionMemoryScorecard} from "../../../../lib/research/decisionMemory";

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
  let snapshot:any=null,persisted:any=null,official:any=null,graph:any=null,factors:any=null,resolution:any=null,expertResolution:any=null,playbookResolution:any=null,decisionResolution:any=null,scorecard:any=null,expertScores:any=null,playbookScores:any=null,decisionScores:any=null;
  try{
    snapshot=await discoverResearchSubjects(symbols);
    persisted=await persistResearchSnapshot({...snapshot,researchUniverseSize:universe.length,bucket,buckets});
  }catch(error){errors.push({stage:"discovery",error:error instanceof Error?error.message:String(error)});}
  try{
    official=await freeOfficialSnapshot(symbols);
    const sql=db();
    await sql`
      insert into audit_events(event_type,entity_type,model_version,payload)
      values('official_source_snapshot','system','free-official-v1',${JSON.stringify({bucket,buckets,symbols,...official})}::jsonb)
    `;
  }catch(error){errors.push({stage:"official-sources",error:error instanceof Error?error.message:String(error)});}
  try{
    graph=await buildFinancialKnowledgeGraph(symbols);
    factors=graphHypotheses(graph);
    const sql=db();
    await sql`
      insert into audit_events(event_type,entity_type,model_version,payload)
      values('knowledge_graph_snapshot','research','financial-knowledge-graph-v1',${JSON.stringify(graph)}::jsonb)
    `;
    for(const h of factors.hypotheses.slice(0,80)){
      const key=h.id+":"+new Date().toISOString().slice(0,10);
      await sql`
        insert into audit_events(event_type,entity_type,entity_id,model_version,payload)
        select 'factor_hypothesis_observed','factor',${key},'factor-discovery-v1',${JSON.stringify(h)}::jsonb
        where not exists(select 1 from audit_events where event_type='factor_hypothesis_observed' and entity_id=${key})
      `;
    }
  }catch(error){errors.push({stage:"knowledge-graph",error:error instanceof Error?error.message:String(error)});}
  try{resolution=await resolveResearchSubjects(18);}catch(error){errors.push({stage:"resolution",error:error instanceof Error?error.message:String(error)});}
  try{expertResolution=await resolveExpertViews(24);}catch(error){errors.push({stage:"expert-resolution",error:error instanceof Error?error.message:String(error)});}
  try{playbookResolution=await resolveInstitutionalPlaybooks(36);}catch(error){errors.push({stage:"playbook-resolution",error:error instanceof Error?error.message:String(error)});}
  try{decisionResolution=await resolveDecisionMemory(48);}catch(error){errors.push({stage:"decision-memory-resolution",error:error instanceof Error?error.message:String(error)});}
  try{scorecard=await researchScorecard(90);}catch(error){errors.push({stage:"scorecard",error:error instanceof Error?error.message:String(error)});}
  try{expertScores=await expertScorecard(90);}catch(error){errors.push({stage:"expert-scorecard",error:error instanceof Error?error.message:String(error)});}
  try{playbookScores=await institutionalPlaybookScorecard(90);}catch(error){errors.push({stage:"playbook-scorecard",error:error instanceof Error?error.message:String(error)});}
  try{decisionScores=await decisionMemoryScorecard(120);}catch(error){errors.push({stage:"decision-memory-scorecard",error:error instanceof Error?error.message:String(error)});}
  return NextResponse.json({
    status:errors.length?"degraded":"ok",
    startedAt,finishedAt:new Date().toISOString(),bucket,buckets,symbols,
    discovered:snapshot?{subjects:snapshot.subjects?.length??0,expertViews:snapshot.experts?.length??0,news:snapshot.newsCount??0,profiles:snapshot.profileCount??0,geography:{
      local:snapshot.geography?.localItems?.length??0,
      usDomestic:snapshot.geography?.usDomesticItems?.length??0,
      global:snapshot.geography?.globalItems?.length??0,
      localConfigured:Boolean(snapshot.geography?.configuredLocalTerms?.length)
    }}:null,
    persisted,graph:graph?{nodes:graph.stats.nodes,edges:graph.stats.edges,multiSourceEdges:graph.stats.multiSourceEdges}:null,factors:factors?{hypotheses:factors.hypotheses.length,candidates:factors.hypotheses.filter((h:any)=>h.state==="candidate").length}:null,official:official?{live:official.live,degraded:official.degraded,unconfigured:official.unconfigured,sources:official.sources.map((s:any)=>({id:s.id,status:s.status,error:s.error??null}))}:null,resolution,expertResolution,playbookResolution,decisionResolution,scorecard,expertScores,playbookScores,decisionScores,errors,
    safety:{executionEligible:false,ordersAllowed:false,mode:"shadow-research-only"}
  });
}
