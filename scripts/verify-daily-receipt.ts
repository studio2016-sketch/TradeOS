import {replayDailyReceipt} from '../lib/research/daily-receipt-replay';
// Bounded JSON input only: no credentials, database connection, network calls or writes.
async function main(){
 try{
  const chunks:Buffer[]=[];let size=0;
  for await(const part of process.stdin){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);size+=chunk.length;if(size>2_000_000)throw Error('oversized');chunks.push(chunk);}
  const result=replayDailyReceipt(JSON.parse(Buffer.concat(chunks).toString('utf8')));process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='PASS')process.exitCode=1;
 }catch{process.stdout.write(JSON.stringify({status:'FAIL',reason:'invalid_receipt',ordersAllowed:false,certified:false})+'\n');process.exitCode=1;}
}
void main();
