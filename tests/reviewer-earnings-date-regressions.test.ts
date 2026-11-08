import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEarningsDate} from '../lib/research/marketwide-event-evidence';
const publishedAt='2030-02-01T12:00:00Z';
test('reviewer: conflicting same-sentence earnings dates must be unavailable',()=>{
 assert.equal(parseEarningsDate('Earnings on March 5, 2030 and earnings on March 6, 2030.',publishedAt),null);
});
test('reviewer: an impossible first earnings date must not be skipped for a later match',()=>{
 assert.equal(parseEarningsDate('Earnings on February 30, 2030 and earnings on March 6, 2030.',publishedAt),null);
});
test('reviewer: ordinal date must not discard its explicit year and invent a current-year event',()=>{
 assert.equal(parseEarningsDate('Earnings on March 5th, 2031.',publishedAt),null);
});
test('reviewer: supported ordinal dates retain explicit years and ordinary valid dates',()=>{
 for(const [day,suffix] of [[1,'st'],[2,'nd'],[3,'rd'],[5,'th'],[11,'th'],[21,'st']] as const){
  assert.equal(parseEarningsDate(`Earnings on March ${day}${suffix}, 2030.`,publishedAt)?.scheduledDate,`2030-03-${String(day).padStart(2,'0')}`);
 }
 assert.equal(parseEarningsDate('Reports earnings March 5th 2030.',publishedAt)?.scheduledDate,'2030-03-05');
 assert.equal(parseEarningsDate('Earnings on March 5th, 20x0.',publishedAt),null);
 assert.equal(parseEarningsDate('Earnings on March 5, 2030garbage.',publishedAt),null);
 assert.equal(parseEarningsDate('Earnings on March 5, 20300.',publishedAt),null);
 assert.equal(parseEarningsDate('Earnings on March 5th2030.',publishedAt),null);
});
test('reviewer: repeated identical same-sentence dates remain usable',()=>{
 assert.equal(parseEarningsDate('Earnings on March 5, 2030 and earnings on March 5, 2030.',publishedAt)?.scheduledDate,'2030-03-05');
});
test('reviewer: explicit adjacent alternative dates without another earnings cue are unavailable',()=>{
 for(const tail of ['or March 6, 2030.','or 6, 2030.','and March 6, 2030.',', or on March 6, 2030.',', March 6, 2030.']){
  assert.equal(parseEarningsDate('Earnings on March 5, 2030 '+tail,publishedAt),null);
 }
 assert.equal(parseEarningsDate('Earnings on March 5th, 2030 or March 6th, 2030.',publishedAt),null);
 assert.equal(parseEarningsDate('Reports earnings Mar. 5, 2030 or Mar. 6, 2030.',publishedAt),null);
 assert.equal(parseEarningsDate('Earnings on March 5, 2030 at 4 p.m.',publishedAt)?.scheduledDate,'2030-03-05');
});
