/** Offline only: input is an authorized JSON export, never a connection string. */
import {readFileSync} from 'node:fs';
import {replayQuoteOutcomeV4} from '../lib/research/quote-resolver-v4';
const [path,asOf]=process.argv.slice(2);
if(!path||!asOf)throw Error('Usage: node --import tsx scripts/replay-quote-outcome-v4.ts export.json explicit-as-of');
const input=JSON.parse(readFileSync(path,'utf8'));
if(!Array.isArray(input.rows)||typeof input.complete!=='boolean')throw Error('Export requires rows and explicit complete boolean');
const r=replayQuoteOutcomeV4(input.forecast,asOf,input.rows.filter((r:any)=>r.kind==='entry'),input.rows.filter((r:any)=>r.kind==='endpoint'),input.complete);
console.log(JSON.stringify(r,null,2));
