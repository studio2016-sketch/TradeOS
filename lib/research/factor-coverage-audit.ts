import {db} from "../db";
import {FACTOR_KEYS} from "./acceleration-factors";

/** Read-only coverage audit. Null is missing, never zero. Dedicated evidence augments but never rewrites raw observation coverage. */
export async function factorCoverageAudit(){
 const sql=db();
 const [rows,evidenceRows]=await Promise.all([
  sql`select factor_key,observation_count,populated_count,populated_pct,last_populated_at,implementation_status,permission_status from tradeos_factor_coverage_status order by factor_key`,
  sql`select e.factor_key,count(*)::int as evidence_count,max(e.available_at) as latest_evidence_at from tradeos_factor_evidence e where not (e.factor_key in ('earnings_date','eps_surprise','revenue_surprise','guidance_change','regulatory_change','buyback_announcement') and e.source_metadata ? 'articleId' and exists(select 1 from tradeos_news_articles n where n.article_id=e.source_metadata->>'articleId' and jsonb_array_length(n.symbols)<>1)) group by e.factor_key order by e.factor_key`
 ]);
 const expected=rows.reduce((n,r)=>n+Number(r.observation_count),0);
 const populated=rows.reduce((n,r)=>n+Number(r.populated_count),0);
 const registered=new Set(rows.map(r=>String(r.factor_key)));
 const evidence=new Map(evidenceRows.map(r=>[String(r.factor_key),{count:Number(r.evidence_count),latest:r.latest_evidence_at}]));
 const invalidLegacyAcceleration=new Set(["var_95","expected_shortfall","max_drawdown"]);
 const factors=FACTOR_KEYS.map(key=>{
  const r=rows.find(row=>String(row.factor_key)===key);
  const e=evidence.get(key);
  const accelerationPopulated=Number(r?.populated_count??0);
  const eligibleAccelerationPopulated=invalidLegacyAcceleration.has(key)?0:accelerationPopulated;
  return {
   key,
   observations:Number(r?.observation_count??0),
   populated:accelerationPopulated,
   eligibleAccelerationPopulated,
   legacyAccelerationIgnored:invalidLegacyAcceleration.has(key)&&accelerationPopulated>0,
   coveragePct:r?.populated_pct===null||r?.populated_pct===undefined?null:Number(r.populated_pct),
   lastPopulatedAt:r?.last_populated_at??null,
   evidenceCount:e?.count??0,
   latestEvidenceAt:e?.latest??null,
   hasMeasuredEvidence:eligibleAccelerationPopulated>0||(e?.count??0)>0,
   implementationStatus:r?.implementation_status??null,
   permissionStatus:r?.permission_status??null
  };
 });
 const measuredFactorCount=factors.filter(f=>f.hasMeasuredEvidence).length;
 return {
  catalogCount:FACTOR_KEYS.length,
  registeredCount:registered.size,
  missingRegistryKeys:FACTOR_KEYS.filter(k=>!registered.has(k)),
  expectedCells:expected,
  populatedCells:populated,
  coveragePct:expected?Math.round(10000*populated/expected)/100:null,
  evidenceRows:evidenceRows.reduce((n,r)=>n+Number(r.evidence_count),0),
  evidencedFactorCount:evidence.size,
  measuredFactorCount,
  measuredFactorPct:Math.round(measuredFactorCount/FACTOR_KEYS.length*1000)/10,
  missingMeasuredKeys:factors.filter(f=>!f.hasMeasuredEvidence).map(f=>f.key),
  factors
 };
}
