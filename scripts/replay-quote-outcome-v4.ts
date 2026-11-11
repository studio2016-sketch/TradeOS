/** Offline only: input is an authorized JSON export, never a connection string. */
import {readFileSync} from 'node:fs';
import {replayQuoteExportV4,verifyQuoteReplayV4} from '../lib/research/quote-resolver-v4';
const [path,asOf]=process.argv.slice(2);
if(!path||!asOf)throw Error('Usage: node --import tsx scripts/replay-quote-outcome-v4.ts export.json explicit-as-of (or archived-report.json --verify)');
const input=JSON.parse(readFileSync(path,'utf8'));
const r=asOf==='--verify'?verifyQuoteReplayV4(input):replayQuoteExportV4(input,asOf);
if(r.status==='REJECTED')process.exitCode=1;
console.log(JSON.stringify(r,null,2));
