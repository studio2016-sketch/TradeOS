import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {BROKER_RECONCILIATION_IMPLEMENTATION} from "../../../../lib/broker/alpaca";
import {EXECUTION_REALISM_IMPLEMENTATION} from "../../../../lib/research/phase5-execution-realism";
import {phase5InfrastructureGate,phase5ScientificStatus} from "../../../../lib/research/phase5-validation";
import {certifyResearch} from "../../../../lib/research/certificationAuthority";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
import {BASELINE_VERSION,CHALLENGER_VERSION,CERTIFICATION_ACTIVATION} from "../../../../lib/research/frozenChallenger";
import {pairedProspectiveValidation} from "../../../../lib/research/phase4-validation";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 try{
  const [phase4Rows,executionRows,tableRows,protectionRows,sourceRows,fillRows,portfolioRows,pairRows]=await Promise.all([
   sql`select created_at,payload from audit_events where event_type='phase4_validation_snapshot' order by created_at desc limit 1`,
   sql`select * from tradeos_execution_validation_snapshots where details->>'trialActivation'=${CERTIFICATION_ACTIVATION} order by created_at desc limit 1`,
   sql`select to_regclass('public.tradeos_source_time_certifications') is not null as source_ready,to_regclass('public.tradeos_fill_slippage_validations') is not null as fill_ready,to_regclass('public.tradeos_portfolio_reconciliation_validations') is not null as portfolio_ready,(select count(*)::int from tradeos_execution_validation_snapshots where details->>'trialActivation'=${CERTIFICATION_ACTIVATION}) as execution_snapshots`,
   sql`select count(distinct c.relname)::int as protected_tables from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and t.tgname in ('forecast_ledger_protect','forecast_outcomes_protect','immutable_decision_records_protect','source_observations_protect','tradeos_factor_evidence_protect','tradeos_decision_source_attestations_protect','tradeos_decision_source_verifications_protect','tradeos_execution_validation_snapshots_protect','tradeos_source_time_certifications_protect','tradeos_fill_slippage_validations_protect','tradeos_portfolio_reconciliation_validations_protect')`,
   sql`select
      (select count(*)::int from forecast_ledger f where f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and f.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as certification_forecasts,
      (select count(*)::int from immutable_decision_records i join forecast_ledger f on f.id=i.forecast_id where f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and i.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as immutable_records,
      (select count(*)::int from immutable_decision_records i join forecast_ledger f on f.id=i.forecast_id join tradeos_decision_source_verifications v on v.immutable_decision_id=i.id where f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and i.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION})) as strict_verified,
      (select count(*)::int from immutable_decision_records i join forecast_ledger f on f.id=i.forecast_id join tradeos_decision_source_verifications v on v.immutable_decision_id=i.id join source_observations so on so.id=v.source_observation_id where f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and i.model_version in (${BASELINE_VERSION},${CHALLENGER_VERSION}) and exists(select 1 from tradeos_source_time_certifications c where c.certification_kind='exchange_authoritative_timestamp' and lower(c.provider)=lower(split_part(so.source_id,':',1)) and lower(c.feed)=lower(split_part(so.source_id,':',2)) and c.created_at<=f.created_at and c.valid_from<=f.created_at and (c.valid_to is null or c.valid_to>f.created_at))) as independently_certified`,
   sql`select * from tradeos_fill_slippage_validations order by created_at desc limit 1`,
   sql`select * from tradeos_portfolio_reconciliation_validations order by created_at desc limit 1`,
   sql`with b as (select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,f.created_at,power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id where f.model_version=${BASELINE_VERSION} and f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and o.was_correct is not null), c as (select f.symbol,f.horizon,date_trunc('minute',f.created_at) as bucket,power(f.probability::float-(case when o.was_correct then 1.0 else 0.0 end),2) as loss from forecast_ledger f join forecast_outcomes o on o.forecast_id=f.id where f.model_version=${CHALLENGER_VERSION} and f.created_at>=${CERTIFICATION_ACTIVATION}::timestamptz and o.was_correct is not null) select b.created_at as time,b.loss as baseline_loss,c.loss as challenger_loss from b join c using(symbol,horizon,bucket) order by b.created_at asc`
  ]);
  const phase4=(phase4Rows as any[])[0]?.payload??null;
  const paired=pairedProspectiveValidation((pairRows as any[]).map(x=>({time:new Date(x.time).toISOString(),baselineLoss:Number(x.baseline_loss),challengerLoss:Number(x.challenger_loss)})));
  const execution=(executionRows as any[])[0]??null;
  const tables=(tableRows as any[])[0]??{};const protections=(protectionRows as any[])[0]??{};const source=(sourceRows as any[])[0]??{};const fill=(fillRows as any[])[0]??null;const portfolio=(portfolioRows as any[])[0]??null;
  const failClosed=certifyResearch({total:1,immutableRecords:0,sourceTimeVerified:0,publicationTimeApplicable:false,publicationTimeVerified:0,outOfSamplePaired:0,independentSessionDates:0,predictiveSkillLowerBound:null,costAdjustedReturnLowerBound:null,portfolioReconciled:false,executionSlippageValidated:false,prospectiveOutcomeRecords:0,prospectiveOutcomeSessions:0,fingerprintedOutcomeRecords:0,prospectiveOutcomePasses:0,prospectiveOutcomeFailures:0});
  const gate=phase5InfrastructureGate({
   phase4Passed:Boolean(phase4?.gate?.passed),certificationForecasts:Number(source.certification_forecasts??0),immutableCleanRecords:Number(source.immutable_records??0),strictCleanVerified:Number(source.strict_verified??0),executionSnapshots:Number(tables.execution_snapshots??0),
   executionImplementation:EXECUTION_REALISM_IMPLEMENTATION,brokerImplementation:BROKER_RECONCILIATION_IMPLEMENTATION,
   sourceCertificationLedgerReady:Boolean(tables.source_ready),fillSlippageLedgerReady:Boolean(tables.fill_ready),portfolioReconciliationLedgerReady:Boolean(tables.portfolio_ready),
   appendOnlyProtectedTables:Number(protections.protected_tables??0),
   certificationFailClosed:failClosed.modelPromotionAllowed===false&&failClosed.liveExecutionAllowed===false&&failClosed.certified===false
  });
  const scientificStatus=phase5ScientificStatus({
   immutableRecords:Number(source.certification_forecasts??0),independentlyCertifiedSourceTimes:Number(source.independently_certified??0),
   pairedSamples:paired.pairs,independentSessions:paired.sessions,pairedSkillLowerBound:paired.lowerBound,
   modeledCostLowerBound:execution?.lower_bound==null?null:Number(execution.lower_bound),modeledCostMature:Boolean(execution?.modeled_cost_mature),
   empiricalSlippageValidated:Boolean(fill?.slippage_validated),portfolioReconciled:Boolean(portfolio?.portfolio_reconciled)
  });
  const payload={generatedAt:new Date().toISOString(),certificationActivation:CERTIFICATION_ACTIVATION,paired,gate,scientificStatus,phase4SnapshotAt:(phase4Rows as any[])[0]?.created_at??null,executionSnapshot:execution?{createdAt:execution.created_at,samples:Number(execution.sample_count),sessions:Number(execution.session_count),meanNetAfterQuotedSpread:execution.mean_net_after_quoted_spread,lowerBound:execution.lower_bound,upperBound:execution.upper_bound,modeledCostMature:Boolean(execution.modeled_cost_mature),executionSlippageValidated:Boolean(execution.execution_slippage_validated)}:null,sourceTime:{certificationForecasts:Number(source.certification_forecasts??0),immutableRecords:Number(source.immutable_records??0),strictVerified:Number(source.strict_verified??0),independentlyCertified:Number(source.independently_certified??0)},latestFillSlippage:fill?{createdAt:fill.created_at,fillCount:Number(fill.fill_count),matchedQuoteCount:Number(fill.matched_quote_count),sessions:Number(fill.session_count),independentReferenceTime:Boolean(fill.independently_certified_reference_time),slippageValidated:Boolean(fill.slippage_validated)}:null,latestPortfolioReconciliation:portfolio?{createdAt:portfolio.created_at,environment:portfolio.environment,snapshotStatus:portfolio.snapshot_status,historyComplete:Boolean(portfolio.history_complete),transactionLineageComplete:Boolean(portfolio.transaction_lineage_complete),ordersFillsIdentityValidated:Boolean(portfolio.orders_fills_identity_validated),cashIdentityValidated:Boolean(portfolio.cash_identity_validated),positionsIdentityValidated:Boolean(portfolio.positions_identity_validated),corporateActionsValidated:Boolean(portfolio.corporate_actions_validated),portfolioReconciled:Boolean(portfolio.portfolio_reconciled)}:null};
  const hour=new Date().toISOString().slice(0,16)+"|"+CERTIFICATION_ACTIVATION;
  await sql`insert into audit_events(event_type,entity_type,entity_id,payload) select 'phase5_validation_snapshot','certification_infrastructure',${hour},${JSON.stringify(payload)}::jsonb where not exists(select 1 from audit_events where event_type='phase5_validation_snapshot' and entity_id=${hour})`;
  await recordCollectorReceipt({collector:"phase5_validation",status:"finished",received:Number(execution?.sample_count??0),saved:1,details:{gatePassed:gate.passed,scientificallyMature:scientificStatus.scientificallyMature,sourceTimeCertified:Number(source.independently_certified??0),empiricalSlippageValidated:Boolean(fill?.slippage_validated)}});
  return NextResponse.json({...payload,scientificCertificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"phase5_validation",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch{}
  return NextResponse.json({status:"phase5_validation_failed",error:failureDetail(e),scientificCertificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
