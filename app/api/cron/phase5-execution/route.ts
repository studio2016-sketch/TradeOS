import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {CHALLENGER_VERSION,TRIAL_ACTIVATION} from "../../../../lib/research/frozenChallenger";
import {evaluateExecutionCostResearch} from "../../../../lib/research/phase5-execution-realism";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 try{
  const [rows,fillRows]=await Promise.all([
   sql`select f.created_at,f.direction,o.realized_return,
      nullif(f.source_snapshot->>'spread','')::double precision as spread_fraction
    from forecast_ledger f
    join forecast_outcomes o on o.forecast_id=f.id
    join immutable_decision_records i on i.forecast_id=f.id
    join tradeos_decision_source_verifications v on v.immutable_decision_id=i.id
    where f.model_version=${CHALLENGER_VERSION}
      and f.created_at>=${TRIAL_ACTIVATION}::timestamptz
      and o.realized_return is not null
      and f.direction in ('bullish','bearish')
      and nullif(f.source_snapshot->>'spread','') is not null
    order by f.created_at asc`,
   sql`select * from tradeos_fill_slippage_validations where slippage_validated=true order by created_at desc limit 1`
  ]);
  const fill=(fillRows as any[])[0]??null;
  const empiricalQualified=Boolean(fill?.slippage_validated)&&Boolean(fill?.independently_certified_reference_time)&&Number.isFinite(Number(fill?.conservative_roundtrip_slippage_fraction));
  const empiricalPenalty=empiricalQualified?Math.max(0,Number(fill.conservative_roundtrip_slippage_fraction)):0;
  const evaluation=evaluateExecutionCostResearch((rows as any[]).map(r=>({
   time:new Date(r.created_at).toISOString(),direction:String(r.direction) as "bullish"|"bearish",
   realizedReturn:Number(r.realized_return),spreadFraction:Number(r.spread_fraction)
  })),empiricalPenalty);
  const inserted=await sql`insert into tradeos_execution_validation_snapshots(
    model_version,sample_count,session_count,mean_gross,mean_quoted_roundtrip_spread_cost,
    mean_net_after_quoted_spread,empirical_roundtrip_slippage_fraction,mean_net_after_all_modeled_costs,lower_bound,upper_bound,modeled_cost_mature,execution_slippage_validated,details
  ) values(
    ${CHALLENGER_VERSION},${evaluation.samples},${evaluation.sessions},${evaluation.meanGross},
    ${evaluation.meanQuotedRoundTripSpreadCost},${evaluation.meanNetAfterQuotedSpread},${evaluation.empiricalRoundTripSlippageFraction},${evaluation.meanNetAfterAllModeledCosts},${evaluation.clustered95[0]},
    ${evaluation.clustered95[1]},${evaluation.mature},${empiricalQualified},
    ${JSON.stringify({trialActivation:TRIAL_ACTIVATION,method:"directional realized return minus one full contemporaneous quoted spread and, when independently qualified, conservative empirical round-trip slippage; session-clustered bootstrap",policy:evaluation.policy,empiricalFillSnapshotId:fill?.id??null})}::jsonb
  ) returning id,created_at`;
  await recordCollectorReceipt({collector:"phase5_execution_realism",status:"finished",received:evaluation.samples,saved:inserted.length,details:{sessions:evaluation.sessions,lowerBound:evaluation.lowerBound,modeledCostMature:evaluation.mature,executionSlippageValidated:empiricalQualified,empiricalPenalty}});
  return NextResponse.json({generatedAt:new Date().toISOString(),modelVersion:CHALLENGER_VERSION,evaluation,snapshot:inserted[0]??null,certification:{costAdjustedReturnLowerBound:empiricalQualified&&evaluation.mature?evaluation.lowerBound:null,executionSlippageValidated:empiricalQualified,reason:empiricalQualified?"Cost model includes independently time-certified empirical fill slippage.":"Quoted-spread research stress test is not actual fill-slippage validation."},liveExecutionAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"phase5_execution_realism",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch{}
  return NextResponse.json({status:"phase5_execution_realism_failed",error:failureDetail(e),liveExecutionAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
