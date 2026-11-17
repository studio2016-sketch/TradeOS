import {persistEvidenceWithSql,type PersistableEvidence} from './persist-evidence';
import {persistExactEvidenceWithSql} from './exact-evidence-store';

/** Prepared activation boundary; not imported by any production route.
 * Keep other factors in legacy storage and move ALL new slippage to the exact lane,
 * rather than splitting the same factor by timestamp precision. Counts describe
 * both lanes, not legacy-table coverage. SQL failure propagates; retries deduplicate.
 */
export async function persistIntradayWithExactSlippage(sql:any,candidates:PersistableEvidence[],now:Date){
 const slippage=candidates.filter(e=>e.factor==='slippage_estimate');
 const other=candidates.filter(e=>e.factor!=='slippage_estimate');
 const legacy=await persistEvidenceWithSql(sql,other,now);
 const exact=await persistExactEvidenceWithSql(sql,slippage,now);
 return {received:legacy.received+exact.received,accepted:legacy.accepted+exact.accepted,saved:legacy.saved+exact.saved,
  rejected:[...legacy.rejected,...exact.rejected],storageLanes:{legacy:legacy.saved,exactSlippage:exact.saved}};
}
