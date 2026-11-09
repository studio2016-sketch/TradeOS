import {readFileSync} from 'node:fs';
import {collectionTraceDiagnostics} from '../lib/research/collection-trace-diagnostics';
try{
 if(process.argv.length!==3)throw Error('Expected one explicit export path');
 const report=collectionTraceDiagnostics(JSON.parse(readFileSync(process.argv[2],'utf8')));
 console.log(JSON.stringify(report,null,2));if(report.status==='UNVERIFIED')process.exitCode=1;
}catch{console.error('Unable to read a valid collection trace export.');process.exitCode=1;}
