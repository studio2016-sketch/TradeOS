import {readFileSync} from 'node:fs';
import {receiptDelayDiagnostics} from '../lib/research/receipt-delay-diagnostics';
try{
 if(process.argv.length!==3)throw Error('Usage: node --import tsx scripts/check-receipt-delays.ts export.json');
 const report=receiptDelayDiagnostics(JSON.parse(readFileSync(process.argv[2],'utf8')));
 console.log(JSON.stringify(report,null,2));
 if(report.status==='UNVERIFIED')process.exitCode=1;
}catch{console.error('Unable to read a valid receipt diagnostic export.');process.exitCode=1;}
