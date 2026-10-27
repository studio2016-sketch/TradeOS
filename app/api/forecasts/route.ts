import { NextResponse } from "next/server";
import { db, hasDatabase } from "../../../lib/db";
import { authorizeIngest } from "../../../lib/security";
import {PREDICTION_OUTCOME_PROTOCOL_ACTIVATION,PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,PREDICTION_OUTCOME_RULE_VERSION} from "../../../lib/research/prediction-outcome-verdict";

export const dynamic="force-dynamic";

export async function GET(){
  if(!hasDatabase()) return NextResponse.json({mode:"database_unconfigured",forecasts:[]});
  const sql=db();
  const rows=await sql`select id,created_at,symbol,horizon,model_version,regime,direction,probability,decision,score,uncertainty,agreement,data_quality from forecast_ledger order by created_at desc limit 50`;
  return NextResponse.json({mode:"database",forecasts:rows});
}

export async function POST(req:Request){
  if(!authorizeIngest(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  if(!hasDatabase()) return NextResponse.json({error:"DATABASE_URL is not configured"},{status:503});
  const body=await req.json();
  const sql=db();
  const sourceSnapshot={...(body.sourceSnapshot??{}),outcomeProtocol:{ruleVersion:PREDICTION_OUTCOME_RULE_VERSION,protocolFingerprint:PREDICTION_OUTCOME_PROTOCOL_FINGERPRINT,activation:PREDICTION_OUTCOME_PROTOCOL_ACTIVATION}};
  const rows=await sql`
    insert into forecast_ledger
      (symbol,horizon,model_version,regime,direction,probability,decision,score,uncertainty,agreement,data_quality,evidence,warnings,source_snapshot)
    values
      (${body.symbol},${body.horizon},${body.modelVersion},${body.regime ?? null},${body.direction},${body.probability},${body.decision},${body.score ?? null},${body.uncertainty ?? null},${body.agreement ?? null},${body.dataQuality ?? null},${JSON.stringify(body.evidence ?? [])},${JSON.stringify(body.warnings ?? [])},${JSON.stringify(sourceSnapshot)})
    returning id,created_at
  `;
  return NextResponse.json({forecast:rows[0]},{status:201});
}
