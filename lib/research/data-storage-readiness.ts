/** Read-only schema/permission interlock before any collection or new writes.
 * Not a replacement for migration review or independent source certification.
 */
export async function assertDataStorageReady(sql:any,kind:'exact'|'daily'){
 const names=kind==='exact'?['tradeos_factor_evidence_exact']:['tradeos_daily_factor_claims','tradeos_daily_factor_completions'];
 const triggers=kind==='exact'?['tradeos_exact_evidence_protect']:['tradeos_daily_claim_protect','tradeos_daily_completion_protect'];
 for(let i=0;i<names.length;i++){
  const relation='public.'+names[i];
  const rows=await sql`select
   to_regclass(${relation}) is not null as present,
   has_table_privilege(to_regclass(${relation}),'SELECT') as readable,
   has_table_privilege(to_regclass(${relation}),'INSERT') as writable,
   exists(select 1 from pg_trigger where tgrelid=to_regclass(${relation}) and tgname=${triggers[i]}
    and not tgisinternal and tgenabled in ('O','A') and (tgtype::int & 58)=58
   ) as protected`;
  const r=rows[0];if(!r||r.present!==true||r.readable!==true||r.writable!==true||r.protected!==true)throw Error('data_storage_not_ready:'+kind);
 }
 if(kind==='daily'){
  const assertion=await sql`select to_regprocedure('public.tradeos_assert_daily_completion(integer,integer,timestamp with time zone)') is not null as present, has_function_privilege(to_regprocedure('public.tradeos_assert_daily_completion(integer,integer,timestamp with time zone)'),'EXECUTE') as executable`;
  if(assertion[0]?.present!==true||assertion[0]?.executable!==true)throw Error('data_storage_not_ready:daily_assertion');
 }
 if(kind==='exact'){
  const rows=await sql`select has_sequence_privilege(to_regclass('public.tradeos_factor_evidence_exact_id_seq'),'USAGE') as sequence_usable,
   count(*) filter(where attname in ('observed_ns','available_ns') and format_type(atttypid,atttypmod)='numeric(30,0)')::int as exact_columns
   from pg_attribute where attrelid=to_regclass('public.tradeos_factor_evidence_exact') and not attisdropped`;
  if(rows[0]?.sequence_usable!==true||Number(rows[0]?.exact_columns)!==2)throw Error('data_storage_not_ready:exact');
 }
 // Existing microsecond storage remains required for non-slippage and daily factors.
 const legacy=await sql`select has_table_privilege(to_regclass('public.tradeos_factor_evidence'),'SELECT') as readable,
  has_table_privilege(to_regclass('public.tradeos_factor_evidence'),'INSERT') as writable,
  has_sequence_privilege(to_regclass('public.tradeos_factor_evidence_id_seq'),'USAGE') as sequence_usable`;
 if(legacy[0]?.readable!==true||legacy[0]?.writable!==true||legacy[0]?.sequence_usable!==true)throw Error('data_storage_not_ready:legacy');
}
