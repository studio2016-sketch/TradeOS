import {evidenceTimestamp,evidenceTimestampIso} from './evidence-time';

export type SlippageCoverage={storage:'not_migrated'|'exact_nanoseconds';count:number;latest:any|null;certified:false};
/** Read-only optional schema discovery. Missing table is distinct from denied/broken access. */
export async function readSlippageCoverage(sql:any,asOf:string,since?:string,subject?:string):Promise<SlippageCoverage>{
 const cutoff=evidenceTimestamp(asOf),start=since===undefined?null:evidenceTimestamp(since);
 if(subject!==undefined&&(typeof subject!=='string'||!subject.trim()))throw Error('invalid_coverage_subject');
 if(cutoff===null||since!==undefined&&(start===null||start>cutoff))throw Error('invalid_coverage_window');
 const exists=await sql`select to_regclass('public.tradeos_factor_evidence_exact') is not null as present`;
 if(exists[0]?.present!==true)return {storage:'not_migrated',count:0,latest:null,certified:false};
 const rows=await sql`select factor_key,value,domain,source_name,subject,observed_at_text as observed_at,
  available_at_text as available_at,observed_ns::text,available_ns::text,count(*) over()::text as total
  from public.tradeos_factor_evidence_exact
  where factor_key='slippage_estimate' and domain='stock' and observed_ns<=available_ns
   and (${subject??null}::text is null or subject=${subject??null}::text)
   and available_ns<=${cutoff.toString()}::numeric and (${start?.toString()??null}::numeric is null or available_ns>=${start?.toString()??null}::numeric)
   and value not in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8)
  order by available_ns desc,id desc limit 1`;
 if(!rows.length)return {storage:'exact_nanoseconds',count:0,latest:null,certified:false};
 const row=rows[0],o=evidenceTimestamp(row.observed_at),a=evidenceTimestamp(row.available_at),count=Number(row.total);
 if(o===null||a===null||o>a||a>cutoff||o.toString()!==row.observed_ns||a.toString()!==row.available_ns||!Number.isSafeInteger(count)||count<1)throw Error('invalid_exact_slippage_coverage');
 return {storage:'exact_nanoseconds',count,latest:{...row,observed_at:evidenceTimestampIso(row.observed_at),available_at:evidenceTimestampIso(row.available_at),storageLane:'exact_nanoseconds'},certified:false};
}
/** Retain exact strings; never compare through Date/milliseconds or infer certification. */
export function mergeLatestSlippage(rows:any[],exact:SlippageCoverage){
 const out=rows.map(row=>({...row,storageLane:'legacy_microseconds'}));
 if(!exact.latest)return out;
 const i=out.findIndex(r=>r.factor_key==='slippage_estimate');
 if(i<0){out.push(exact.latest);return out;}
 const a=evidenceTimestamp(out[i].available_at),b=evidenceTimestamp(exact.latest.available_at);
 if(a===null||b===null)throw Error('invalid_slippage_merge_clock');
 if(b>a)out[i]=exact.latest;
 else if(b===a){
  if(Number(out[i].value)!==Number(exact.latest.value)||out[i].subject!==exact.latest.subject||out[i].source_name!==exact.latest.source_name||evidenceTimestamp(out[i].observed_at)!==evidenceTimestamp(exact.latest.observed_at))throw Error('conflicting_cross_lane_slippage');
  out[i]={...exact.latest,storageLane:'matching_legacy_and_exact'};
 }
 return out;
}

/** Prepared subject-scoped reader for both histories. Legacy cutoffs are numeric too:
 * casting a nanosecond decision to timestamptz would round it before comparison.
 * No outcome/forecast consumer is switched implicitly.
 */
export async function readSlippageAtDecisionWithSql(sql:any,subject:string,decisionTime:string){
 const cutoff=evidenceTimestamp(decisionTime);
 if(cutoff===null||typeof subject!=='string'||!subject.trim())throw Error('invalid_slippage_decision_query');
 const legacy=await sql`select factor_key,value,domain,source_name,subject,observed_at::text as observed_at,available_at::text as available_at
  from tradeos_factor_evidence where factor_key='slippage_estimate' and domain='stock' and subject=${subject}
   and observed_at<=available_at and extract(epoch from available_at)*1000000000<=${cutoff.toString()}::numeric
   and value is not null and value not in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8)
  order by available_at desc,id desc limit 1`;
 const exact=await readSlippageCoverage(sql,decisionTime,undefined,subject);
 const latest=mergeLatestSlippage(legacy,exact)[0];
 return latest?{...latest,observed_at:evidenceTimestampIso(latest.observed_at),available_at:evidenceTimestampIso(latest.available_at),certified:false}:null;
}
