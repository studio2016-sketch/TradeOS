import {db} from "../db";
import {FACTOR_KEYS} from "./acceleration-factors";

/** Read-only coverage audit. Null is missing, never zero. */
export async function factorCoverageAudit(){
 const sql=db();
 const rows=await sql`select factor_key,observation_count,populated_count,populated_pct,last_populated_at,implementation_status,permission_status from tradeos_factor_coverage_status order by factor_key`;
 const expected=rows.reduce((n,r)=>n+Number(r.observation_count),0);
 const populated=rows.reduce((n,r)=>n+Number(r.populated_count),0);
 const registered=new Set(rows.map(r=>String(r.factor_key)));
 return {
  catalogCount:FACTOR_KEYS.length,
  registeredCount:registered.size,
  missingRegistryKeys:FACTOR_KEYS.filter(k=>!registered.has(k)),
  expectedCells:expected,
  populatedCells:populated,
  coveragePct:expected?Math.round(10000*populated/expected)/100:null,
  factors:rows.map(r=>({key:String(r.factor_key),observations:Number(r.observation_count),populated:Number(r.populated_count),coveragePct:r.populated_pct===null?null:Number(r.populated_pct),lastPopulatedAt:r.last_populated_at,implementationStatus:r.implementation_status,permissionStatus:r.permission_status}))
 };
}
