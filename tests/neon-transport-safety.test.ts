import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('transport audit refuses unknown/production endpoints and never prints supplied credentials',()=>{
 const secret='SYNTHETIC_SECRET_MUST_NOT_APPEAR';
 for(const connectionString of [`postgresql://fixture:${secret}@production.invalid/neondb`,`postgresql://fixture:${secret}@ep-divine-sound-b518lv6g.c-7.us-east-2.aws.neon.tech/${secret}`,'not-a-connection-string']){
  const result=spawnSync(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/check-neon-evidence-transport.ts',import.meta.url))],{input:JSON.stringify({connectionString})+'\n',encoding:'utf8',timeout:5000});
  assert.equal(result.status,1);assert.equal(result.stdout,'');
  const failure=JSON.parse(result.stderr);
  assert.equal(failure.status,'FAIL');assert.equal(failure.stage,'staging_endpoint_validation');
  assert.equal(result.stderr.includes(secret),false);
  assert.equal(result.stderr.includes(connectionString),false);
 }
});
