import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
import {forwardPE,estimateRevision,ivRank,portfolioRiskFactors} from "../../../../lib/research/specialized-factor-calculations";
export const dynamic="force-dynamic";
export const maxDuration=60;

// Read-only, evidence-first registry audit. Never infer licensed access from
// a source label, and never treat numeric coverage as a certified implementation.
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 if(!hasDatabase())return NextResponse.json({error:"database_unavailable"},{status:503});
 const sql=db();
 const rows=await sql`
  select r.factor_key,r.source_name,r.calculation_method,
   r.implementation_status,r.permission_status,
   coalesce(s.populated_count,0)::int as acceleration_samples,
   coalesce(e.evidence_count,0)::int as evidence_samples,
   e.latest_evidence,r.freshness_seconds
  from tradeos_factor_coverage_registry r
  left join tradeos_factor_coverage_status s using(factor_key)
  left join (
   select factor_key,count(*)::int as evidence_count,max(available_at) as latest_evidence
   from tradeos_factor_evidence where value is not null group by factor_key
  ) e using(factor_key)
  order by r.factor_key`;
 // Execute real deterministic calculation checks, not a source-name heuristic.
 // These prove only the sampled arithmetic/guards; they do not certify
 // provider entitlement, historical source-time, or full production wiring.
 const now="2026-10-22T20:00:00Z",prior="2026-10-21T20:00:00Z",later="2026-10-23T20:00:00Z";
 const portfolio=portfolioRiskFactors({equity:10000,availableAt:now,positions:[{symbol:"TEST",sector:"Technology",marketValue:2000}]},now,100,50,500,-100);
 const arithmeticChecks:Record<string,boolean>={
  pe_forward:forwardPE({value:100,availableAt:now},{value:5,availableAt:prior},now)===20&&forwardPE({value:100,availableAt:now},{value:5,availableAt:later},now)===null,
  estimate_revision:estimateRevision({value:2,availableAt:prior},{value:3,availableAt:now},now)===50,
  iv_rank:ivRank({value:1,availableAt:now},[],now)===null,
  portfolio_exposure:portfolio?.portfolio_exposure===20,
  single_name_weight:portfolio?.single_name_weight===20,
  sector_concentration:portfolio?.sector_concentration===20,
  risk_budget_remaining:portfolio?.risk_budget_remaining===400,
  position_volatility:portfolio?.position_volatility===null
 };
 const factors=rows.map(r=>{
  const key=String(r.factor_key),implementation=String(r.implementation_status);
  const permission=String(r.permission_status);
  const samples=Number(r.acceleration_samples)+Number(r.evidence_samples);
  const domain=["portfolio_exposure","position_volatility","risk_budget_remaining","sector_concentration","single_name_weight"].includes(key)?"portfolio_risk":
   ["iv_rank"].includes(key)?"derivatives":
   ["estimate_revision","pe_forward","pmi_manufacturing"].includes(key)?"fundamentals_macro":
   ["competitor_event","supplier_event","earnings_call_sentiment","geographic_exposure"].includes(key)?"event_intelligence":"other";
  const latestMs=r.latest_evidence?Date.parse(String(r.latest_evidence)):NaN;
  const freshnessSeconds=Number(r.freshness_seconds);
  const evidenceFresh=Number.isFinite(latestMs)&&Number.isFinite(freshnessSeconds)&&freshnessSeconds>0&&latestMs<=Date.now()&&Date.now()-latestMs<=freshnessSeconds*1000;
  const blockers=[
   ...(samples===0?["no_numeric_observations"]:[]),
   ...(!evidenceFresh?["freshness_not_demonstrated"]:[]),
   ...(["unknown","unverified"].includes(permission)?["permission_not_verified"]:[]),
   ...(["unknown","unverified"].includes(implementation)?["implementation_not_verified"]:[])
  ];
  return {factor:key,domain,accelerationSamples:Number(r.acceleration_samples),
   evidenceSamples:Number(r.evidence_samples),latestEvidence:r.latest_evidence,
   freshnessSeconds,evidenceFresh,
   implementationStatus:implementation,permissionStatus:permission,
   calculationSmokeCheck:arithmeticChecks[key]===undefined?"not_implemented":arithmeticChecks[key]?"passed":"failed",
   providerPermissionCheck:"not_reprobed",
   verifiedImplementation:implementation==="verified"&&evidenceFresh,
   verifiedPermission:false,
   blockers,requiredSource:r.source_name,requiredCalculation:r.calculation_method};
 });
 const calculationChecksPassed=Object.values(arithmeticChecks).filter(Boolean).length;
 const summary={calculationChecksPassed,calculationChecksAttempted:Object.keys(arithmeticChecks).length,registered:factors.length,numericMeasured:factors.filter(x=>x.accelerationSamples+x.evidenceSamples>0).length,
  missingNumeric:factors.filter(x=>x.accelerationSamples+x.evidenceSamples===0).map(x=>x.factor),
  freshEvidence:factors.filter(x=>x.evidenceFresh).length,
  verifiedImplementation:factors.filter(x=>x.verifiedImplementation).length,
  verifiedPermission:factors.filter(x=>x.verifiedPermission).length,
  fullyVerified:factors.filter(x=>x.verifiedImplementation&&x.verifiedPermission).length};
 return NextResponse.json({generatedAt:new Date().toISOString(),summary,factors,
  certificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false,
  warning:"Calculation smoke checks execute deterministic samples only. Freshness is checked against latest available_at and the registered SLA; vendor permission is not re-probed, so permission remains unverified regardless of stored labels. No factor is promoted."},
  {headers:{"Cache-Control":"no-store"}});
}
