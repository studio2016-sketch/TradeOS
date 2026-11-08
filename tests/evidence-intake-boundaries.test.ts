import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvidence} from '../lib/research/evidence-gate';
import {evidenceTimestamp} from '../lib/research/evidence-time';
import {persistEvidenceWithSql} from '../lib/research/persist-evidence';
import {auditEvidence} from '../lib/research/source-vintage-audit';
const good={factor:'daily_volume',value:100,domain:'stock' as const,source:'Alpaca',subject:'SPY',observedAt:'2030-01-01T00:00:00Z',availableAt:'2030-01-01T00:00:01Z'};
const now=new Date('2030-01-01T00:01:00Z');
test('invalid clock and unknown domains cannot bypass intake rules',()=>{
 assert.equal(validateEvidence(good,new Date('bad')).accepted,false);
 for(const domain of ['other','toString','__proto__',null,undefined])assert.equal(validateEvidence({...good,domain},now).accepted,false);
});
test('malformed runtime fields are rejected without throwing',()=>{
 for(const input of [null,[],false,{}, {...good,source:1},{...good,subject:null},{...good,value:'100'},{...good,availableAt:1}])assert.equal(validateEvidence(input,now).accepted,false);
});
test('impossible or ambiguous timestamps are not normalized into evidence',()=>{
 for(const t of ['2030-02-30T00:00:00Z','2030-01-01T24:00:00Z','2030-01-01T00:00:00','2030-01-01','2030-01-01T00:00:00+25:00'])assert.equal(validateEvidence({...good,observedAt:t},now).accepted,false);
 assert.notEqual(evidenceTimestamp('2032-02-29T00:00:00Z'),null);
});
test('nanosecond receipt reversals fail and timezone-equivalent instants compare equally',()=>{
 assert.equal(validateEvidence({...good,observedAt:'2030-01-01T00:00:00.000002Z',availableAt:'2030-01-01T00:00:00.000001Z'},now).accepted,false);
 assert.equal(evidenceTimestamp('2030-01-01 00:00:00.123456+00'),evidenceTimestamp('2029-12-31T18:00:00.123456000-06:00'));
});
test('30-second allowance and domain freshness boundaries retain exact inclusive limits',()=>{
 const clock=new Date('2030-01-06T00:00:00Z');
 assert.equal(validateEvidence({...good,availableAt:'2030-01-06T00:00:30Z'},clock).accepted,true);
 assert.equal(validateEvidence({...good,availableAt:'2030-01-06T00:00:30.000000001Z'},clock).accepted,false);
 assert.equal(validateEvidence({...good,availableAt:'2030-01-01T00:00:00Z'},clock).accepted,true);
 assert.equal(validateEvidence({...good,availableAt:'2030-01-01T00:00:00Z'},new Date(clock.getTime()+1)).accepted,false);
});
test('invalid candidates never reach storage; valid candidates use the real insert path',async()=>{
 const calls:string[]=[];const sql=async(s:TemplateStringsArray)=>{calls.push(s.join('?'));return[{id:'test'}];};
 const candidates=[null,{...good,domain:'bad'},{...good,source:10},good] as any;
 const r=await persistEvidenceWithSql(sql,candidates,now);
 assert.equal(r.saved,1);assert.equal(r.rejected.length,3);assert.equal(calls.length,1);assert.match(calls[0],/insert into tradeos_factor_evidence/);
});
test('decision audit rejects postdecision nanoseconds even inside intake clock allowance',()=>{
 const e={...good,observedAt:'2030-01-01T00:00:00Z',availableAt:'2030-01-01T00:00:01.000000001Z'};
 assert.equal(auditEvidence([e],'2030-01-01T00:00:01Z').measured,0);
 assert.equal(auditEvidence([{...good,domain:'bad'} as any],'2030-01-01T00:01:00Z').measured,0);
 assert.equal(auditEvidence([{...good,source:'   '}],'2030-01-01T00:01:00Z').measured,0);
});
test('audit selects the latest exact receipt rather than input order within a millisecond',()=>{
 const earlier={...good,value:1,availableAt:'2030-01-01T00:00:01.000001Z'},later={...good,value:2,availableAt:'2030-01-01T00:00:01.000002Z'};
 for(const rows of [[earlier,later],[later,earlier]])assert.equal(auditEvidence(rows,'2030-01-01T00:01:00Z').evidence[0].value,2);
});
