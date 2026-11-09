import test from 'node:test';
import assert from 'node:assert/strict';
import {observedNewsFactorsWithDependencies as collect,WATCHLIST_NEWS_EVIDENCE_VERSION} from '../lib/research/news-factor-evidence';
import {cachedNewsWithSql} from '../lib/market/news';
import {evidenceTimestamp,evidenceTimestampIso} from '../lib/research/evidence-time';
import {auditEvidence} from '../lib/research/source-vintage-audit';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
import type {NewsSignal} from '../lib/market/types';
import type {NewsReactionContext} from '../lib/market/newsReaction';
const start=new Date('2030-02-01T12:00:00Z');
const article=(extra:Partial<NewsSignal>={}):NewsSignal=>({id:'fixture:1',timestamp:'2030-02-01T11:59:00.123456Z',headline:'Company raises guidance',symbols:['TEST'],source:'Synthetic publisher',sourceQuality:.8,novelty:1,marketImpact:.5,priceConfirmed:false,summary:'',...extra});
const reaction=(extra:Partial<NewsReactionContext>={}):NewsReactionContext=>({symbol:'TEST',generatedAt:'2030-02-01T12:00:02Z',matched:true,headline:'Synthetic article',timestamp:'2030-02-01T11:59:00Z',measuredThrough:'2030-02-01T12:00:01Z',returnPct:1.25,reactionScore:60,classification:'moderate',note:'Synthetic fixture',...extra});
async function run(rows:NewsSignal[],options:{now?:Date;reaction?:NewsReactionContext|null;clocks?:string[];symbols?:string[]}={}){
 const now=options.now??start;let calls=0;
 const clocks=options.clocks??[new Date(now.getTime()+1000).toISOString(),new Date(now.getTime()+2000).toISOString(),new Date(now.getTime()+3000).toISOString()];
 return collect(options.symbols??['TEST'],{news:async()=>({news:rows,errors:[]}),reaction:async()=>options.reaction??null,clock:()=>new Date(clocks[Math.min(calls++,clocks.length-1)])},now);
}
test('watchlist availability begins after asynchronous inputs complete and cannot enter an earlier decision',async()=>{
 const result=await run([article()],{reaction:reaction()});
 assert.equal(result.requestedAt,start.toISOString());assert.equal(result.retrievedAt,'2030-02-01T12:00:03.000Z');
 assert.ok(result.candidates.every(e=>e.availableAt===result.retrievedAt&&e.metadata?.extractionVersion===WATCHLIST_NEWS_EVIDENCE_VERSION));
 const event=result.candidates.find(e=>e.factor==='guidance_change')!;
 assert.equal(event.observedAt,article().timestamp);
 const measured=result.candidates.find(e=>e.factor==='news_price_reaction')!;
 assert.equal(measured.observedAt,reaction().measuredThrough);assert.equal(measured.metadata?.articleTimestamp,reaction().timestamp);
 assert.equal(auditEvidence(result.candidates,'2030-02-01T12:00:02Z').measured,0);
 const inserts:unknown[][]=[];
 const stored=await persistEvidenceWithSql(async(_s:TemplateStringsArray,...v:unknown[])=>{inserts.push(v);return[{id:'synthetic'}];},result.candidates,new Date(result.retrievedAt));
 assert.equal(stored.saved,result.candidates.length);assert.equal(stored.rejected.length,0);
 assert.equal(JSON.parse(inserts[0][7] as string).evidenceIntake.availableAt,result.retrievedAt);
});
test('impossible and ambiguous publication timestamps cannot become news counts or event evidence',async()=>{
 const now=new Date('2030-03-02T12:00:00Z');
 const rows=['2030-02-30T11:59:00Z','2030-03-02T11:59:00','2030-03-02','bad'].map(timestamp=>article({timestamp}));
 const result=await run(rows,{now});assert.equal(result.newsCount,4);assert.equal(result.eligibleNewsCount,0);assert.equal(result.candidates.length,0);
});
test('submillisecond future and stale articles are excluded before aggregate denominators',async()=>{
 const result=await run([
  article({headline:'Tariff risk'}),
  article({id:'future',timestamp:'2030-02-01T12:00:00.000000001Z',headline:'Ordinary news'}),
  article({id:'stale',timestamp:'2030-01-31T11:59:59.999999999Z'}),
  article({id:'boundary',timestamp:'2030-01-31T12:00:00Z',headline:'Tariff risk'})
 ]);
 assert.equal(result.eligibleNewsCount,2);
 assert.equal(result.candidates.find(e=>e.factor==='headline_count')?.value,2);
 assert.equal(result.candidates.find(e=>e.factor==='tariff_exposure')?.value,1);
});
test('mixed offsets and submillisecond observations select the latest exact event deterministically',async()=>{
 const rows=[article({timestamp:'2030-02-01T11:00:00Z'}),article({id:'latest',timestamp:'2030-02-01T06:30:00.000002-06:00'})];
 for(const ordered of [rows,[...rows].reverse()]){
  const result=await run(ordered,{now:new Date('2030-02-01T13:00:00Z')});
  assert.equal(result.candidates.find(e=>e.factor==='guidance_change')?.observedAt,rows[1].timestamp);
 }
});
test('multi-issuer articles cannot establish company-specific guidance, buybacks or regulatory events',async()=>{
 const headline='Company raises guidance and announces buyback; SEC launches investigation';
 const ambiguous=await run([article({headline,symbols:['TEST','OTHER']})],{symbols:['TEST','OTHER']});
 const company=new Set(['guidance_change','buyback_announcement','regulatory_change','analyst_revision']);
 assert.equal(ambiguous.candidates.filter(e=>company.has(e.factor)).length,0);
 assert.equal(ambiguous.candidates.filter(e=>e.factor==='headline_count').length,2);
 const unambiguous=await run([article({headline})]);
 for(const factor of ['guidance_change','buyback_announcement','regulatory_change'])assert.ok(unambiguous.candidates.some(e=>e.factor===factor));
});
test('missing, reversed, future, over-window or mismatched reaction provenance stays unavailable',async()=>{
 for(const invalid of [reaction({measuredThrough:undefined}),reaction({measuredThrough:'2030-02-01T11:58:00Z'}),reaction({measuredThrough:'2030-02-01T12:00:02.000000001Z'}),reaction({timestamp:'2030-02-30T11:59:00Z'}),reaction({symbol:'OTHER'}),reaction({timestamp:'2030-02-01T09:00:00Z',measuredThrough:'2030-02-01T11:30:00Z'})]){
  const result=await run([],{reaction:invalid});
  assert.equal(result.candidates.filter(e=>['news_price_reaction','event_materiality'].includes(e.factor)).length,0);
 }
});
test('invalid numerical source weights cannot fabricate neutral sentiment or analyst revision',async()=>{
 const result=await run([article({headline:'Broker upgrades company price target',sourceQuality:NaN})]);
 assert.ok(result.candidates.some(e=>e.factor==='headline_count'));
 assert.equal(result.candidates.some(e=>['news_sentiment','analyst_revision'].includes(e.factor)),false);
});
test('a backwards completion clock aborts extraction before persistence',async()=>{
 for(const clocks of [['2030-02-01T12:00:01Z','2030-02-01T12:00:02Z','2030-02-01T12:00:01Z'],['2030-02-01T12:00:01Z','2030-02-01T12:00:00Z','2030-02-01T12:00:03Z']])await assert.rejects(run([article()],{clocks}),/clock moved backwards/);
});
test('cached news preserves publication microseconds in browser-compatible ISO spelling',async()=>{
 const rows=await cachedNewsWithSql(async(s:TemplateStringsArray,...values:unknown[])=>{
  assert.match(s.join('?'),/published_at::text as published_at/);assert.equal(values[0],'fixture');
  return[{article_id:'cache:1',published_at:'2030-02-01 11:59:00.123456+00',headline:'Synthetic',symbols:['TEST'],source_name:'Fixture',source_quality:.8,summary:''},
   {article_id:'cache:2',published_at:'2030-02-30 11:59:00+00',headline:'Invalid',symbols:['TEST'],source_name:'Fixture',source_quality:.8}];
 },'fixture',['TEST'],10);
 assert.equal(rows.length,1);assert.equal(rows[0].timestamp,'2030-02-01T11:59:00.123456+00:00');
 assert.equal(evidenceTimestamp(rows[0].timestamp),evidenceTimestamp('2030-02-01T11:59:00.123456Z'));
 assert.ok(Number.isFinite(Date.parse(rows[0].timestamp)));
});
test('ISO timestamp normalization changes spelling without changing exact instants',()=>{
 for(const [input,expected] of [['2030-02-01 11:59:00.123456+00','2030-02-01T11:59:00.123456+00:00'],['2030-02-01T05:59:00.123456000-0600','2030-02-01T05:59:00.123456000-06:00'],['2030-02-01T11:59:00Z','2030-02-01T11:59:00Z']]){
  const normalized=evidenceTimestampIso(input);assert.equal(normalized,expected);assert.equal(evidenceTimestamp(normalized),evidenceTimestamp(input));
 }
 assert.equal(evidenceTimestampIso('2030-02-30T00:00:00Z'),null);
});
test('independent reaction lookups start together before extraction availability is stamped',{timeout:1000},async()=>{
 let started=0,release!:()=>void;
 const ready=new Promise<void>(resolve=>{release=resolve;});
 const batch=[article({symbols:['AAA']})];
 const result=await collect(['AAA','BBB','CCC'],{news:async()=>({news:batch,errors:[]}),reaction:async(_symbol,snapshot)=>{assert.deepEqual(snapshot,batch);if(++started===3)release();await ready;return null;},clock:()=>new Date('2030-02-01T12:00:01Z')},start);
 assert.equal(started,3);assert.equal(result.retrievedAt,'2030-02-01T12:00:01.000Z');
});
