import {NextResponse} from "next/server";
import {db,hasDatabase} from "../../../lib/db";
import {researchScorecard,expertScorecard,institutionalPlaybookScorecard} from "../../../lib/research/ledger";

export const dynamic="force-dynamic";

export async function GET(){
  if(!hasDatabase())return NextResponse.json({status:"database_unconfigured"});
  try{
    const sql=db();
    const [snapshots,subjects,experts,outcomes,scorecard,expertScores,playbookScores]=await Promise.all([
      sql`
        select payload,created_at
        from audit_events
        where event_type='research_radar_snapshot'
        order by created_at desc
        limit 1
      `,
      sql`
        select entity_id,payload,created_at
        from audit_events
        where event_type='research_subject_observed'
        order by created_at desc
        limit 40
      `,
      sql`
        select entity_id,payload,created_at
        from audit_events
        where event_type='expert_view_observed'
        order by created_at desc
        limit 40
      `,
      sql`
        select entity_id,payload,created_at
        from audit_events
        where event_type='research_subject_outcome'
        order by created_at desc
        limit 80
      `,
      researchScorecard(90),
      expertScorecard(90),
      institutionalPlaybookScorecard(90)
    ]);
    return NextResponse.json({
      status:"ok",
      latestSnapshot:(snapshots as any[])[0]??null,
      subjects,
      experts,
      outcomes,
      scorecard,
      expertScorecard:expertScores,
      institutionalPlaybookScorecard:playbookScores,
      safety:{executionEligible:false,ordersAllowed:false,mode:"shadow-research-only"},
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return NextResponse.json({status:"degraded",error:error instanceof Error?error.message:String(error)},{status:503});
  }
}
