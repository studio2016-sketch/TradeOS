import test from 'node:test';
import assert from 'node:assert/strict';
import {observedMarketwideEventEvidenceWithSql as collect,parseEarningsDate,REPORTED_NEWS_PARSER_VERSION} from '../lib/research/marketwide-event-evidence';
import {persistEvidenceWithSql,EVIDENCE_PERSISTENCE_TIME_POLICY} from '../lib/research/persist-evidence';
import {validateEvidence,EVIDENCE_INTAKE_POLICY_VERSION} from '../lib/research/evidence-gate';
import {auditEvidence} from '../lib/research/source-vintage-audit';
const clock=()=>new Date('2030-02-01T12:00:00Z');
const article=(headline:string,extra:Record<string,unknown>={})=>({article_id:'synthetic:1',published_at:'2030-02-01 11:59:00.123456+00',headline,summary:'',symbols:['TEST'],source_name:'Synthetic publisher',...extra});
function reader(rows:unknown[]){return async(s:TemplateStringsArray)=>{assert.match(s.join('?'),/published_at::text as published_at/);return rows;};}
test('date tokens reject fractional days without inferring a different explicit year',()=>{
 for(const day of ['5.5','5.0','5.50','5th.5'])for(const year of ['2030','2031'])assert.equal(parseEarningsDate(`Earnings on March ${day}, ${year}.`,clock().toISOString()),null);
});
test('comma-separated release clocks remain usable while alternative dates stay unavailable',()=>{
 for(const time of ['5 pm','5:30 p.m.','12 a.m.','at 4 PM'])assert.equal(parseEarningsDate(`Earnings on March 5, 2030, ${time}.`,clock().toISOString())?.scheduledDate,'2030-03-05');
 for(const tail of ['or March 6, 2030.',', 6, 2030.',', 5 pm or March 6, 2030.',', 5 pm, March 6, 2030.',', 20x0.',', 2030garbage.'])assert.equal(parseEarningsDate('Earnings on March 5, 2030 '+tail,clock().toISOString()),null);
});
test('actual collector preserves publication microseconds and persists parser, units and protected intake provenance',async()=>{
 const {candidates}=await collect(reader([article('EPS $-1.20 beats $-1.40 estimate. Revenue $1.2B beats $900M consensus. Earnings on March 5, 2030, 5 pm.')]),clock);
 assert.equal(candidates.length,3);const inserts:unknown[][]=[];
 const sql=async(s:TemplateStringsArray,...values:unknown[])=>{assert.match(s.join('?'),/on conflict do nothing returning id/);inserts.push(values);return[{id:'synthetic'}];};
 assert.equal((await persistEvidenceWithSql(sql,candidates,clock())).saved,3);
 for(const values of inserts){
  assert.equal(values[5],'2030-02-01 11:59:00.123456+00');assert.equal(values[6],clock().toISOString());
  const metadata=JSON.parse(values[7] as string);assert.equal(metadata.parserVersion,REPORTED_NEWS_PARSER_VERSION);
  assert.equal(metadata.articleId,'synthetic:1');assert.equal(metadata.availabilityKind,'extraction_completed');
  assert.equal(metadata.evidenceIntake.policyVersion,EVIDENCE_INTAKE_POLICY_VERSION);
  assert.equal(metadata.evidenceIntake.persistenceTimePolicy,EVIDENCE_PERSISTENCE_TIME_POLICY);
  assert.equal(metadata.evidenceIntake.observedAt,values[5]);assert.equal(metadata.evidenceIntake.availableAt,values[6]);
 }
 assert.ok(candidates.filter(x=>x.factor.endsWith('surprise')).every(x=>x.metadata?.unit==='fraction_vs_reported_estimate'));
});
test('availability clock is sampled after retrieval and extraction, not at request start',async()=>{
 let completed=false;
 const rows=[article('EPS $2 beats $1 estimate')];
 const sql=async()=>{completed=true;return rows;};
 const {candidates}=await collect(sql,()=>{assert.equal(completed,true);return new Date('2030-02-01T12:00:05Z');});
 assert.equal(candidates[0].availableAt,'2030-02-01T12:00:05.000Z');
});
test('malformed amounts, contradictions and invalid schedules never reach the insert boundary',async()=>{
 for(const text of ['EPS $1,43 beats $1.20 estimate','EPS $1 beats $2 estimate','Revenue $1.2B misses $900M estimate','Earnings on February 30, 2030.','EPS $2 beats $1 estimate. EPS $3 beats $1 estimate.','Earnings on March 5.5, 2031.']){
  const {candidates}=await collect(reader([article(text)]),clock);
  assert.equal(candidates.length,0,text);
  assert.equal((await persistEvidenceWithSql(async()=>assert.fail('Invalid article reached INSERT'),candidates,clock())).saved,0);
 }
});
test('publication after completion by one microsecond is rejected before SQL',async()=>{
 for(const published_at of ['2030-02-01 12:00:00.000001+00','2030-02-01T12:00:00.001Z']){
  const {candidates,rejectedArticles}=await collect(reader([article('EPS $2 beats $1 estimate',{published_at})]),clock);
  assert.equal(candidates.length,0);assert.equal(rejectedArticles[0].reason,'publication_after_retrieval');
  const result=await persistEvidenceWithSql(async()=>assert.fail('Future publication reached SQL'),candidates,clock());
  assert.equal(result.saved,0);
 }
});
test('a future nontariff article cannot contaminate an otherwise valid tariff denominator',async()=>{
 const {candidates}=await collect(reader([article('Tariff risk'),article('Ordinary report',{article_id:'future',published_at:'2030-02-01T12:00:00.000001Z'})]),clock);
 assert.equal(candidates.find(x=>x.factor==='tariff_exposure')?.value,1);
});
test('completion clock reversal fails closed',async()=>{
 let calls=0;
 await assert.rejects(collect(reader([article('EPS $2 beats $1 estimate')]),()=>new Date(calls++?'2030-02-01T11:59:59Z':'2030-02-01T12:00:00Z')),/completion clock precedes retrieval/);
});
test('invalid publication timestamps are isolated rather than normalized or crashing the whole batch',async()=>{
 const {candidates,rejectedArticles}=await collect(reader([
  article('EPS $2 beats $1 estimate',{published_at:'2030-02-30T00:00:00Z'}),
  article('EPS $2 beats $1 estimate',{published_at:'not-a-date'}),
  article('EPS $2 beats $1 estimate',{published_at:'2030-02-01'}),
  article('EPS $2 beats $1 estimate')
 ]),clock);
 assert.equal(candidates.length,1);assert.equal(rejectedArticles.length,3);
 assert.ok(rejectedArticles.every(x=>x.reason==='invalid_publication_timestamp'));
});
test('mixed timestamp offsets choose latest tariff publication by instant rather than text',async()=>{
 const {candidates}=await collect(reader([
  article('Tariff risk',{published_at:'2030-02-01 11:00:00+00'}),
  article('Tariff risk',{article_id:'synthetic:2',published_at:'2030-02-01 06:30:00-06'})
 ]),()=>new Date('2030-02-01T13:00:00Z'));
 assert.equal(candidates.find(x=>x.factor==='tariff_exposure')?.observedAt,'2030-02-01 06:30:00-06');
});
test('storage rejects nonzero submicroseconds and accepts exactly representable padded microseconds',async()=>{
 const {candidates}=await collect(reader([article('EPS $2 beats $1 estimate')]),clock);const e=candidates[0];
 for(const field of ['observedAt','availableAt'] as const){
  const invalid={...e,[field]:'2030-02-01T12:00:00.000000001Z'};
  if(field==='observedAt')invalid.availableAt='2030-02-01T12:00:01Z';
  assert.equal(validateEvidence(invalid,clock()).accepted,true);
  const r=await persistEvidenceWithSql(async()=>assert.fail('Lossy timestamp reached SQL'),[invalid],clock());
  assert.deepEqual(r.rejected[0].reasons,['unsupported_storage_precision']);assert.equal(r.accepted,0);
 }
 const padded={...e,observedAt:'2030-02-01T11:59:00.123456000Z',availableAt:'2030-02-01T12:00:00.000000000Z'};
 assert.equal((await persistEvidenceWithSql(async()=>[{id:'synthetic'}],[padded],clock())).saved,1);
});
test('news freshness and decision chronology preserve their different exact boundaries',async()=>{
 const {candidates}=await collect(reader([article('EPS $2 beats $1 estimate')]),clock);const e=candidates[0];
 const boundary={...e,observedAt:'2030-01-29T00:00:00Z',availableAt:'2030-01-30T12:00:00Z'};
 assert.equal(validateEvidence(boundary,clock()).accepted,true);
 assert.equal(validateEvidence({...boundary,availableAt:'2030-01-30T11:59:59.999999999Z'},clock()).accepted,false);
 const future={...e,availableAt:'2030-02-01T12:00:00.000001Z'};
 assert.equal(validateEvidence(future,clock()).accepted,true);assert.equal(auditEvidence([future],clock().toISOString()).measured,0);
 const earlier={...e,value:1,availableAt:'2030-02-01T12:00:00.000001Z'},later={...e,value:2,availableAt:'2030-02-01T12:00:00.000002Z'};
 for(const rows of [[earlier,later],[later,earlier]])assert.equal(auditEvidence(rows,'2030-02-01T12:00:01Z').evidence[0].value,2);
});
test('SQL conflict no-op, partial batch failure and protected metadata have explicit behavior',async()=>{
 const {candidates}=await collect(reader([article('EPS $2 beats $1 estimate')]),clock);const e=candidates[0];
 assert.deepEqual(await persistEvidenceWithSql(async()=>[],[e],clock()),{received:1,accepted:1,saved:0,rejected:[]});
 let calls=0;
 await assert.rejects(persistEvidenceWithSql(async()=>{if(++calls===2)throw Error('synthetic SQL rejection');return[{id:'first'}];},[e,e],clock()),/synthetic SQL rejection/);
 assert.equal(calls,2); // Inserts are individually append-only, not a batch transaction.
 await persistEvidenceWithSql(async(_s:TemplateStringsArray,...v:unknown[])=>{
  assert.equal(JSON.parse(v[7] as string).evidenceIntake.policyVersion,EVIDENCE_INTAKE_POLICY_VERSION);return[];
 },[{...e,metadata:{...e.metadata,evidenceIntake:{policyVersion:'forged'}}}],clock());
});
