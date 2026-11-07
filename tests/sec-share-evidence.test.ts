import test from 'node:test';
import capitalReview from '../lib/market/meta-capital-review.json';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseMetaShareClasses,valuationPriceReason,validateMetaShareEvidence,metaSubsequentFilingReview,annualValuationInputUsable} from '../lib/market/sec-share-evidence';
const fixture=readFileSync(new URL('./fixtures/meta-share-classes.html',import.meta.url),'utf8');
test('official cover-page contexts sum A and B once, preserving raw provenance',()=>{
 const parts=parseMetaShareClasses(fixture)!;
 assert.equal(parts.length,2);assert.equal(parts.reduce((n,c)=>n+c.value,0),2556241253);
 assert.equal(parts[0].instant,'2026-10-16');assert.match(parts[0].rawContext,/CommonClassAMember/);
});
test('missing, duplicate, extra and incompatible class contexts fail closed',()=>{
 const facts=fixture.match(/<ix:nonFraction[\s\S]*?<\/ix:nonFraction>/g)!;
 for(const html of [fixture.replace(facts[1],''),fixture+facts[0],fixture.replace('CommonClassBMember','PreferredStockMember'),fixture.replace('CommonClassBMember','CommonClassAMember'),fixture.replace('c-3"','absent"'),fixture.replaceAll('2026-10-16','nonsense'),fixture.replace('scale="0"','scale="3"'),fixture.replace('unitRef="shares"','unitRef="USD"'),fixture.replace('341,768,886','341768886.5'),fixture.replace('341,768,886','-1'),fixture.replace('341,768,886','0'),fixture.replace('decimals="INF"','decimals="-6"'),fixture.replace('0001326801','0000000001')])assert.equal(parseMetaShareClasses(html),null);
 assert.equal(parseMetaShareClasses(fixture.replace(/2026-10-16/, '2026-10-15')),null);
});
test('fresh price after disclosure accepted; outdated, future, missing and pre-filing rejected',()=>{
 const p={filed:'2026-10-22',end:'2026-10-16'},now='2026-11-07T12:00:00Z';
 assert.equal(valuationPriceReason(650,'2026-11-06T21:00:00Z',now,p),null);
 assert.equal(valuationPriceReason(650,'2026-11-02T21:00:00Z',now,p),'market_price_outdated_or_future');
 assert.equal(valuationPriceReason(650,'2026-11-08T21:00:00Z',now,p),'market_price_outdated_or_future');
 assert.equal(valuationPriceReason(NaN,'',now,p),'market_price_missing_or_invalid');
 assert.equal(valuationPriceReason(650,'2026-10-22T20:00:00Z','2026-10-23T12:00:00Z',p),'price_share_filing_date_mismatch');
 assert.equal(valuationPriceReason(650,'2026-11-06T21:00:00Z',now,{filed:'invalid',end:'2026-10-16'}),'price_share_filing_date_mismatch');
});
test('recapitalization and unreviewed identity/content never unlock a denominator',()=>{
 assert.equal(validateMetaShareEvidence(fixture,{},'2027-01-19T00:00:00Z','2027-01-19T00:01:00Z').reason,'recapitalization_requires_new_class_and_price_review');
 assert.equal(validateMetaShareEvidence(fixture,{cik:1},'2026-11-07T12:00:00Z','2026-11-07T12:01:00Z').reason,'issuer_mismatch');
});

test('new reports, capital actions and offerings require review, while ownership-only reports do not',()=>{
 const accepted='2026-10-22T00:00:08Z',now='2026-11-07T12:00:00Z';
 const recent={accessionNumber:['base','new'],form:['10-Q','4'],acceptanceDateTime:[accepted,'2026-11-05T12:00:00Z']};
 assert.deepEqual(metaSubsequentFilingReview(recent,accepted,now),{});
 for(const form of ['8-K','10-Q','10-Q/A','424B5','S-3ASR','DEF 14C','8-A12B']){
  recent.form[1]=form;const result=metaSubsequentFilingReview(recent,accepted,now);
  assert.equal(result.reason,'subsequent_filings_require_corporate_action_review');assert.deepEqual(result.blockingAccessions,['new']);
 }
 recent.acceptanceDateTime[1]='invalid';assert.equal(metaSubsequentFilingReview(recent,accepted,now).reason,'invalid_subsequent_filing_timestamp');
});
test('annual numerator requires a valid annual period, accession and publication before price',()=>{
 const p={start:'2025-01-01',end:'2025-12-31',filed:'2026-02-05',accession:'test'};
 assert.equal(annualValuationInputUsable(100,p,'2026-11-06T21:00:00Z'),true);
 for(const invalid of [{...p,filed:'2026-11-07'},{...p,start:'2025-10-01'},{...p,accession:''},{...p,filed:'2025-12-01'}])assert.equal(annualValuationInputUsable(100,invalid,'2026-11-06T21:00:00Z'),false);
});

test('filing identity, availability and full-document integrity are enforced',()=>{
 const s={cik:1326801,filings:{recent:{accessionNumber:['0001628280-26-066773'],form:['10-Q'],filingDate:['2026-10-22'],acceptanceDateTime:['2026-10-22T00:00:08.000Z'],primaryDocument:['meta-20260930.htm']}}};
 const check=(asOf='2026-11-07T12:00:00Z')=>validateMetaShareEvidence(fixture,s,asOf,'2026-11-07T12:01:00Z');
 assert.equal(check().reason,'unreviewed_filing_content');
 assert.equal(check('2026-10-22T20:00:00Z').reason,'filing_identity_or_availability_mismatch');
 s.filings.recent.filingDate[0]='2026-10-21';assert.equal(check().reason,'filing_identity_or_availability_mismatch');
 s.filings.recent.filingDate[0]='2026-10-22';s.filings.recent.primaryDocument[0]='another.htm';assert.equal(check().reason,'filing_identity_or_availability_mismatch');
});

test('only exact reviewed subsequent filings with freshly verified document digests clear the action gate',()=>{
 const items=capitalReview.items;
 const recent={accessionNumber:items.map(i=>i.accession),form:items.map(i=>i.form),filingDate:items.map(i=>i.filed),acceptanceDateTime:items.map(i=>i.acceptedAt),primaryDocument:items.map(i=>i.primaryDocument)};
 const hashes=Object.fromEntries(items.map(i=>[i.accession,i.sha256]));
 const check=()=>metaSubsequentFilingReview(recent,'2026-10-22T00:00:08Z','2026-11-07T12:00:00Z',hashes);
 assert.deepEqual(check(),{});
 hashes[items[0].accession]='changed';assert.equal(check().reason,'subsequent_filings_require_corporate_action_review');
 hashes[items[0].accession]=items[0].sha256;
 recent.primaryDocument[0]='changed.htm';assert.equal(check().reason,'subsequent_filings_require_corporate_action_review');
 assert.equal(metaSubsequentFilingReview(recent,'2026-10-22T00:00:08Z','2026-11-07T12:00:00Z').reason,'subsequent_filings_require_corporate_action_review');
 assert.equal(capitalReview.currentSharesVerified,false);assert.equal(capitalReview.shareCountAdjustment,0);
});
