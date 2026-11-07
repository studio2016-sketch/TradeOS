// Read-only fresh-source audit. Inputs are newly downloaded official SEC responses.
// Does not persist factors, certify source time, or replay historical availability.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateMetaShareEvidence} from '../lib/market/sec-share-evidence';
const [filingPath,submissionsPath]=process.argv.slice(2);
if(!filingPath||!submissionsPath)throw new Error('Usage: tsx scripts/check-sec-share-evidence.ts <filing.html> <submissions.json>');
const receivedAt=new Date().toISOString(),html=readFileSync(filingPath,'utf8'),raw=readFileSync(submissionsPath,'utf8');
const result=validateMetaShareEvidence(html,JSON.parse(raw),receivedAt,receivedAt);
console.log(JSON.stringify({checkedAt:receivedAt,filingSha256:createHash('sha256').update(html).digest('hex'),submissionsSha256:createHash('sha256').update(raw).digest('hex'),shares:result.observation?.shares,shareInstant:result.observation?.end,ratioEligible:!result.reason&&!!result.observation,reason:result.reason,blockingAccessions:result.blockingAccessions,backtestEligible:false},null,2));
