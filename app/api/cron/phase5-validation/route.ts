import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {BROKER_RECONCILIATION_IMPLEMENTATION} from "../../../../lib/broker/alpaca";
import {EXECUTION_REALISM_IMPLEMENTATION} from "../../../../lib/research/phase5-execution-realism";
import {phase5InfrastructureGate,phase5ScientificStatus} from "../../../../lib/research/phase5-validation";
import {certifyResearch} from "../../../../lib/research/certificationAuthority";
import {recordCollectorReceipt,failureDetail} from "../../../../lib/research/collector-receipts";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 try{
  const [phase4Rows,executionRows,tableRows,protectionRows,sourceRows,fillRows,portfolioRows]=await Promise.all([
   sql`select created_at,payload from audit_events where event_type='phase4_validation_snapshot' order by created_at desc limit 1`,
   sql`select * from tradeos_execution_validation_snapshots order by created_at desc limit 1`,
   sql`select to_regclass('public.tradeos_source_time_certifications') is not null as source_ready,to_regclass('public.tradeos_fill_slippage_validations') is not null as fill_ready,to_regclass('public.tradeos_portfolio_reconciliation_validations') is not null as portfolio_ready,(select count(*)::int from tradeos_execution_validation_snapshots) as execution_snapshots`,
   sql`select count(distinct c.relname)::int as protected_tables from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and t.tgname in ('forecast_ledger_protect','forecast_outcomes_protect','immutable_decision_records_protect','source_observations_protect','tradeos_factor_evidence_protect','tradeos_decision_source_attestations_protect','tradeos_decision_source_verifications_protect','tradeos_execution_validation_snapshots_protect','tradeos_source_time_certifications_protect','tradeos_fill_slippage_validations_protect','tradeos_portfolio_reconciliation_validations_protect')`,
   sql`select count(*)::int as immutable_records,count(*) filter(where exists(
       select 1 from tradeos_source_time_certifications c
       join source_observations so on so.id=v.source_observation_id
       where c.certification_kind='exchange_authoritative_timestamp'
         and lower(c.provider)=lower(split_part(so.source_id,':',1))
         and lower(c.feed)=lower(split_part(so.source_id,':',2))
         and c.valid_from<=f.created_at
         and (c.valid_to is null or c.valid_to>f.created_at)
     ))::int as independently_certified
     from immutable_decision_records i join forecast_ledger f on f.id=i.forecast_id join tradeos_decision_source_verifications v on v.immutable_decision_id=i.id`,
   sql`select * from tradeos_fill_slippage_validations order by created_at desc limit 1`,
   sql`select * from tradeos_portfolio_reconciliation_validations order by created_at desc limit 1`
  ]);
  const phase4=(phase4Rows as any[])[0]?.payload??null;
  const execution=(executionRows as any[])[0]??null;
  const tables=(tableRows as any[])[0]??{};const protections=(protectionRows as any[])[0]??{};const source=(sourceRows as any[])[0]??{};const fill=(fillRows as any[])[0]??null;const portfolio=(portfolioRows as any[])[0]??null;
  const failClosed=certifyResearch({total:1,immutableRecords:0,sourceTimeVerified:0,publicationTimeApplicable:false,publicationTimeVerified:0,outOfSamplePaired:0,independentSessionDates:0,predictiveSkillLowerBound:null,costAdjustedReturnLowerBound:null,portfolioReconciled:false,executionSlippageValidated:false});
  const gate=phase5InfrastructureGate({
   phase4Passed:Boolean(phase4?.gate?.passed),executionSnapshots:Number(tables.execution_snapshots??0),
   executionImplementation:EXECUTION_REALISM_IMPLEMENTATION,brokerImplementation:BROKER_RECONCILIATION_IMPLEMENTATION,
   sourceCertificationLedgerReady:Boolean(tables.source_ready),fillSlippageLedgerReady:Boolean(tables.fill_ready),portfolioReconciliationLedgerReady:Boolean(tables.portfolio_ready),
   appendOnlyProtectedTables:Number(protections.protected_tables??0),
   certificationFailClosed:failClosed.modelPromotionAllowed===false&&failClosed.liveExecutionAllowed===false&&failClosed.certified===false
  });
  const scientificStatus=phase5ScientificStatus({
   immutableRecords:Number(source.immutable_records??0),independentlyCertifiedSourceTimes:Number(source.independently_certified??0),
   pairedSamples:Number(phase4?.paired?.pairs??0),independentSessions:Number(phase4?.paired?.sessions??0),pairedSkillLowerBound:phase4?.paired?.lowerBound==null?null:Number(phase4.paired.lowerBound),
   modeledCostLowerBound:execution?.lower_bound==null?null:Number(execution.lower_bound),modeledCostMature:Boolean(execution?.modeled_cost_mature),
   empiricalSlippageValidated:Boolean(fill?.slippage_validated),portfolioReconciled:Boolean(portfolio?.portfolio_reconciled)
  });
  const payload={generatedAt:new Date().toISOString(),gate,scientificStatus,phase4SnapshotAt:(phase4Rows as any[])[0]?.created_at??null,executionSnapshot:execution?{createdAt:execution.created_at,samples:Number(execution.sample_count),sessions:Number(execution.session_count),meanNetAfterQuotedSpread:execution.mean_net_after_quoted_spread,lowerBound:execution.lower_bound,upperBound:execution.upper_bound,modeledCostMature:Boolean(execution.modeled_cost_mature),executionSlippageValidated:Boolean(execution.execution_slippage_validated)}:null,sourceTime:{immutableRecords:Number(source.immutable_records??0),independentlyCertified:Number(source.independently_certified??0)},latestFillSlippage:fill?{createdAt:fill.created_at,fillCount:Number(fill.fill_count),matchedQuoteCount:Number(fill.matched_quote_count),sessions:Number(fill.session_count),independentReferenceTime:Boolean(fill.independently_certified_reference_time),slippageValidated:Boolean(fill.slippage_validated)}:null,latestPortfolioReconciliation:portfolio?{createdAt:portfolio.created_at,environment:portfolio.environment,snapshotStatus:portfolio.snapshot_status,historyComplete:Boolean(portfolio.history_complete),transactionLineageComplete:Boolean(portfolio.transaction_lineage_complete),ordersFillsIdentityValidated:Boolean(portfolio.orders_fills_identity_validated),cashIdentityValidated:Boolean(portfolio.cash_identity_validated),positionsIdentityValidated:Boolean(portfolio.positions_identity_validated),corporateActionsValidated:Boolean(portfolio.corporate_actions_validated),portfolioReconciled:Boolean(portfolio.portfolio_reconciled)}:null};
  const hour=new Date().toISOString().slice(0,13);
  await sql`insert into audit_events(event_type,entity_type,entity_id,payload) select 'phase5_validation_snapshot','certification_infrastructure',${hour},${JSON.stringify(payload)}::jsonb where not exists(select 1 from audit_events where event_type='phase5_validation_snapshot' and entity_id=${hour})`;
  await recordCollectorReceipt({collector:"phase5_validation",status:"finished",received:Number(execution?.sample_count??0),saved:1,details:{gatePassed:gate.passed,scientificallyMature:scientificStatus.scientificallyMature,sourceTimeCertified:Number(source.independently_certified??0),empiricalSlippageValidated:Boolean(fill?.slippage_validated)}});
  return NextResponse.json({...payload,scientificCertificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  try{await recordCollectorReceipt({collector:"phase5_validation",status:"failed",received:0,saved:0,details:{error:failureDetail(e)}});}catch{}
  return NextResponse.json({status:"phase5_validation_failed",error:failureDetail(e),scientificCertificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
