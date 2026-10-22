import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
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
   e.latest_evidence
  from tradeos_factor_coverage_registry r
  left join tradeos_factor_coverage_status s using(factor_key)
  left join (
   select factor_key,count(*)::int as evidence_count,max(available_at) as latest_evidence
   from tradeos_factor_evidence where value is not null group by factor_key
  ) e using(factor_key)
  order by r.factor_key`;
 const factors=rows.map(r=>{
  const key=String(r.factor_key),implementation=String(r.implementation_status);
  const permission=String(r.permission_status);
  const samples=Number(r.acceleration_samples)+Number(r.evidence_samples);
  const domain=["portfolio_exposure","position_volatility","risk_budget_remaining","sector_concentration","single_name_weight"].includes(key)?"portfolio_risk":
   ["iv_rank"].includes(key)?"derivatives":
   ["estimate_revision","pe_forward","pmi_manufacturing"].includes(key)?"fundamentals_macro":
   ["competitor_event","supplier_event","earnings_call_sentiment","geographic_exposure"].includes(key)?"event_intelligence":"other";
  const blockers=[
   ...(samples===0?["no_numeric_observations"]:[]),
   ...(["unknown","unverified"].includes(permission)?["permission_not_verified"]:[]),
   ...(["unknown","unverified"].includes(implementation)?["implementation_not_verified"]:[])
  ];
  return {factor:key,domain,accelerationSamples:Number(r.acceleration_samples),
   evidenceSamples:Number(r.evidence_samples),latestEvidence:r.latest_evidence,
   implementationStatus:implementation,permissionStatus:permission,
   verifiedImplementation:implementation==="verified",
   verifiedPermission:permission==="verified",
   blockers,requiredSource:r.source_name,requiredCalculation:r.calculation_method};
 });
 const summary={registered:factors.length,numericMeasured:factors.filter(x=>x.accelerationSamples+x.evidenceSamples>0).length,
  missingNumeric:factors.filter(x=>x.accelerationSamples+x.evidenceSamples===0).map(x=>x.factor),
  verifiedImplementation:factors.filter(x=>x.verifiedImplementation).length,
  verifiedPermission:factors.filter(x=>x.verifiedPermission).length,
  fullyVerified:factors.filter(x=>x.verifiedImplementation&&x.verifiedPermission).length};
 return NextResponse.json({generatedAt:new Date().toISOString(),summary,factors,
  certificationGranted:false,modelPromotionAllowed:false,liveExecutionAllowed:false,
  warning:"Registry labels and measured values are not independently validated implementations or confirmed vendor entitlements."},
  {headers:{"Cache-Control":"no-store"}});
}
