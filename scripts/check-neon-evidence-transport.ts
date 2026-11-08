import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {neon} from '@neondatabase/serverless';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
import {observedMarketwideEventEvidenceWithSql} from '../lib/research/marketwide-event-evidence';
import {evidenceTimestamp} from '../lib/research/evidence-time';

// Deliberately pinned to the independently identified existing staging endpoint.
// A production or unknown URL is rejected before any network request.
const STAGING_HOST='ep-divine-sound-b518lv6g.c-7.us-east-2.aws.neon.tech';
let stage='staging_endpoint_validation';
async function main(){
 const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
 const line=await lines[Symbol.asyncIterator]().next();lines.close();process.stdin.pause();
 (process.stdin as typeof process.stdin&{unref?:()=>void}).unref?.();
 const {connectionString}=JSON.parse(line.value??'{}');
 const url=new URL(connectionString);
 assert.ok(['postgres:','postgresql:'].includes(url.protocol));
 assert.ok([STAGING_HOST,STAGING_HOST.replace('.c-7.','-pooler.c-7.')].includes(url.hostname),'Not the approved staging endpoint');
 assert.equal(url.pathname,'/neondb');
 const sql=neon(connectionString);
 const now=new Date('2030-02-01T12:00:00Z');
 const evidence={factor:'eps_surprise',value:1,domain:'news' as const,source:'Synthetic transport check',subject:'TRANSPORT_TEST',observedAt:'2030-02-01T11:59:00.123456000Z',availableAt:now.toISOString(),metadata:{synthetic:true}};
 // LIKE copies current staging columns/defaults/constraints/indexes, never rows.
 // Replace the copied sequence default so even staging's persistent sequence is untouched.
 const setup=()=>[
  sql.query('CREATE TEMP TABLE tradeos_factor_evidence (LIKE public.tradeos_factor_evidence INCLUDING ALL) ON COMMIT DROP'),
  sql.query('ALTER TABLE pg_temp.tradeos_factor_evidence ALTER COLUMN id SET DEFAULT 1'),
  sql.query('CREATE TRIGGER transport_append_only BEFORE UPDATE OR DELETE ON pg_temp.tradeos_factor_evidence FOR EACH ROW EXECUTE FUNCTION public.tradeos_reject_decision_mutation()'),
  sql.query('SET LOCAL search_path=pg_temp,public')
 ];
 let inserts=0;let roundtrip:Record<string,any>|undefined;
 const isolatedSql=async(strings:TemplateStringsArray,...values:any[])=>{
  assert.match(strings.join('?'),/^insert into tradeos_factor_evidence\(/);
  inserts++;
  const initial=setup();const results=await sql.transaction([...initial,sql(strings,...values),sql(strings,...values),
   sql.query(`select observed_at,observed_at::text as observed_text,available_at::text as available_text,source_metadata,
    (select nspname from pg_namespace where oid=(select relnamespace from pg_class where oid=e.tableoid)) as namespace
    from pg_temp.tradeos_factor_evidence e`)],{isolationLevel:'Serializable'});
  assert.equal(results[initial.length+1].length,0,'Duplicate insert did not conflict');
  roundtrip=results[initial.length+2][0];assert.ok(roundtrip.namespace.startsWith('pg_temp_'));
  return results[initial.length];
 };
 stage='persistence_roundtrip';
 const persisted=await persistEvidenceWithSql(isolatedSql,[evidence],now);
 assert.equal(persisted.saved,1);assert.ok(roundtrip);
 assert.equal(evidenceTimestamp(roundtrip.observed_text),evidenceTimestamp(evidence.observedAt));
 assert.equal(evidenceTimestamp(roundtrip.available_text),evidenceTimestamp(evidence.availableAt));
 assert.equal(roundtrip.source_metadata.evidenceIntake.observedAt,evidence.observedAt);
 stage='gate_rejection';const before=inserts;
 const rejected=await persistEvidenceWithSql(isolatedSql,[{...evidence,availableAt:'2030-02-01T12:00:00.000000001Z'},{...evidence,observedAt:'2030-02-01T12:00:00.000001Z'}],now);
 assert.equal(rejected.rejected.length,2);assert.equal(inserts,before);
 stage='rounding';
 const [rounding]=await sql.transaction([sql`select ${'2030-02-01T12:00:00.000000001Z'}::timestamptz=${evidence.availableAt}::timestamptz as same`],{readOnly:true});
 assert.equal(rounding[0].same,true);
 stage='sql_cutoff';const initial=setup();const readback=await sql.transaction([...initial,
  sql.query(`insert into pg_temp.tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at) values('eps_surprise','news','CUTOFF',1,'synthetic',$1,$2)`,[evidence.observedAt,'2030-02-01T12:00:00.000001Z']),
  sql.query('select count(*)::int as eligible from pg_temp.tradeos_factor_evidence where available_at<=$1::timestamptz',[evidence.availableAt])]);
 assert.equal(readback[initial.length+1][0].eligible,0);
 for(const verb of ['UPDATE','DELETE'] as const){
  stage='append_only_'+verb;
  const query=verb==='UPDATE'?'UPDATE pg_temp.tradeos_factor_evidence SET value=99':'DELETE FROM pg_temp.tradeos_factor_evidence';
  await assert.rejects(sql.transaction([...setup(),
   sql.query(`insert into pg_temp.tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at) values('eps_surprise','news','GUARD',1,'synthetic',$1,$2)`,[evidence.observedAt,evidence.availableAt]),sql.query(query)]),(e:any)=>e.code==='P0001');
 }
 // Proposed backstop is exercised only on a temporary table, never applied to public evidence.
 stage='proposed_constraint';await assert.rejects(sql.transaction([...setup(),
  sql.query('ALTER TABLE pg_temp.tradeos_factor_evidence ADD CONSTRAINT transport_vintage_order CHECK (observed_at<=available_at) NOT VALID'),
  sql.query(`insert into pg_temp.tradeos_factor_evidence(factor_key,domain,subject,value,source_name,observed_at,available_at) values('eps_surprise','news','BAD',1,'synthetic',$1,$2)`,['2030-02-01T12:00:01Z',evidence.availableAt])]),(e:any)=>e.code==='23514');
 const collectorSql=async(strings:TemplateStringsArray,...values:any[])=>{
  const results=await sql.transaction([
   sql.query('CREATE TEMP TABLE tradeos_news_articles (LIKE public.tradeos_news_articles INCLUDING ALL) ON COMMIT DROP'),
   sql.query(`insert into pg_temp.tradeos_news_articles(provider,article_id,published_at,headline,symbols,source_name,source_quality) values('synthetic','transport:1',$1,'EPS $2 beats $1 estimate','["TRANSPORT_TEST"]','Synthetic transport check',1)`,[evidence.observedAt]),
   sql.query('SET LOCAL search_path=pg_temp,public'),
   sql(strings,...values)]);
  return results[3];
 };
 stage='collector';const extracted=await observedMarketwideEventEvidenceWithSql(collectorSql,()=>now);
 assert.equal(extracted.candidates.length,1);
 assert.equal(evidenceTimestamp(extracted.candidates[0].observedAt),evidenceTimestamp(evidence.observedAt));
 assert.equal((await persistEvidenceWithSql(isolatedSql,extracted.candidates,now)).saved,1);
 const report={status:'PASS',target:'existing_staging_branch_temporary_tables',driver:'@neondatabase/serverless@1.2.0',checks:['actual_persistence_insert_and_duplicate','microsecond_text_readback','protected_metadata','precision_and_chronology_rejection_before_sql','submicrosecond_rounding_reproduced','exact_sql_cutoff','append_only_update_and_delete_rejection','proposed_vintage_constraint_temporary_only','actual_news_collector_and_insert'],nativeTimestampKind:roundtrip.observed_at instanceof Date?'Date':typeof roundtrip.observed_at,productionWrites:false,persistentTestTables:false,scientificallyCertified:false};
 process.stdout.write(JSON.stringify(report)+'\n');
}
main().catch((error:unknown)=>{
 // Never print connection strings, SQL error details or stacks from credential-bearing requests.
 const code=(error as {code?:unknown})?.code;
 process.stderr.write(JSON.stringify({status:'FAIL',stage,code:typeof code==='string'&&/^[A-Z0-9_]+$/.test(code)?code:'TRANSPORT_CHECK_FAILED'})+'\n');process.exitCode=1;
});
