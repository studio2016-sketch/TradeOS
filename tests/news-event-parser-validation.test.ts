import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReportedSurprises as surprises,parseEarningsDate as earnings} from '../lib/research/marketwide-event-evidence';
const pub='2030-02-01T12:00:00Z';
test('impossible earnings dates cannot roll forward into apparently measured events',()=>{
 for(const date of ['February 30, 2030','February 29, 2030','April 31, 2030','March 0, 2030','March 32, 2030'])assert.equal(earnings('Earnings on '+date+'.',pub),null);
 assert.equal(earnings('Earnings on February 29, 2032.','2032-02-01T12:00:00Z')?.scheduledDate,'2032-02-29');
});
test('year rollover and explicit year without comma are recognized without normalization',()=>{
 assert.equal(earnings('Earnings on January 5.','2030-12-01T12:00:00Z')?.scheduledDate,'2031-01-05');
 assert.equal(earnings('Earnings on March 5 2030.',pub)?.scheduledDate,'2030-03-05');
 assert.equal(earnings('Earnings on March 5, 20x0.',pub),null);
});
test('multiple earnings dates are ambiguous, repeated identical date text is allowed',()=>{
 assert.equal(earnings('Earnings on March 5, 2030. Earnings on March 6, 2030.',pub),null);
 assert.equal(earnings('Earnings on March 5, 2030. Earnings on March 5, 2030.',pub)?.scheduledDate,'2030-03-05');
});
test('malformed grouping and trailing punctuation in amounts cannot become numerical evidence',()=>{
 for(const value of ['1,43','1,,000','1,000,00','1.2.3','1.2,3','1,000.']){
  assert.equal(surprises('EPS $'+value+' beats $1.20 estimate').eps,null);
  assert.equal(surprises('Revenue $'+value+'M beats $1.20M estimate').revenue,null);
 }
});
test('well-formed comma groups, negative EPS and scaled revenue remain measurable',()=>{
 assert.equal(surprises('EPS $1,234.50 beats $1,200.00 estimate').eps?.actual,1234.5);
 assert.ok(Math.abs(surprises('EPS $-1.20 beats $-1.40 estimate').eps!.surprise-1/7)<1e-12);
 const revenue=surprises('Revenue $1.2B beats $900M consensus').revenue;
 assert.equal(revenue?.actual,1200000000);assert.equal(revenue?.estimate,900000000);
});
test('contradictory action labels and nonfinite surprise arithmetic are unavailable',()=>{
 for(const text of ['EPS $1 beats $2 estimate','EPS $2 misses $1 estimate','EPS $1 beats $1 estimate','EPS $1 beats $0 estimate'])assert.equal(surprises(text).eps,null);
 assert.equal(surprises('EPS $'+'9'.repeat(309)+' beats $1 estimate').eps,null);
 assert.equal(surprises('EPS $'+'9'.repeat(308)+' beats $-'+'9'.repeat(308)+' estimate').eps,null);
});
test('conflicting same-metric reports cannot choose the first quarter or restatement silently',()=>{
 assert.equal(surprises('EPS $2 beats $1 estimate. EPS $3 beats $1 estimate.').eps,null);
 assert.equal(surprises('EPS $2 beats $1 estimate. EPS $2 beats $1 estimate.').eps?.actual,2);
});
