// Read-only fresh-source audit. Inputs are newly downloaded official SEC responses.
// Does not persist factors, certify source time, or replay historical availability.
import {join} from 'node:path';
import capitalReview from '../lib/market/meta-capital-review.json';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateMetaShareEvidence} from '../lib/market/sec-share-evidence';
const [filingPath,submissionsPath,reviewDirectory]=process.argv.slice(2);
if(!filingPath||!submissionsPath)throw new Error('Usage: tsx scripts/check-sec-share-evidence.ts <filing.html> <submissions.json>');
const receivedAt=new Date().toISOString(),html=readFileSync(filingPath,'utf8'),raw=readFileSync(submissionsPath,'utf8');
const reviewedDocuments=reviewDirectory?Object.fromEntries(capitalReview.items.map(item=>[item.accession,createHash('sha256').update(readFileSync(join(reviewDirectory,item.accession))).digest('hex')])):undefined;
const result=validateMetaShareEvidence(html,JSON.parse(raw),receivedAt,receivedAt,reviewedDocuments);
console.log(JSON.stringify({checkedAt:receivedAt,filingSha256:createHash('sha256').update(html).digest('hex'),submissionsSha256:createHash('sha256').update(raw).digest('hex'),shares:result.observation?.shares,shareInstant:result.observation?.end,shareBasis:result.observation?.shareBasis,currentSharesVerified:result.observation?.currentSharesVerified,ratioEligible:!result.reason&&!!result.observation,reason:result.reason,blockingAccessions:result.blockingAccessions,backtestEligible:false},null,2));
