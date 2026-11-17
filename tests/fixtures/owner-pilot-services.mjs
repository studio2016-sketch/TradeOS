// Test-only services: no network, credentials, or real database.
export const DATA_ACTIVATION_POLICY={exactSlippageWrites:false,get dailyInvocation(){return globalThis.__ownerPilot.approval;}};
export const auth={getSession:async()=>{globalThis.__ownerPilot.calls.push('session');return globalThis.__ownerPilot.session;}};
export function db(){
 const driver=()=>({fixture:true});
 driver.transaction=async(_queries,options)=>{
  const f=globalThis.__ownerPilot;f.calls.push(options.readOnly?'readonly':'write');
  if(!options.readOnly)throw Error('test forbids actual write transport');
  return [[f.account]];
 };
 return driver;
}
export async function assertDataStorageReady(){const f=globalThis.__ownerPilot;f.calls.push('preflight');if(f.failPreflight)throw Error('private fixture error');}
export async function runPreparedDailyFactorCollection(_sql,clock){
 const f=globalThis.__ownerPilot;f.calls.push('run');clock();
 if(f.failRun)throw Error('unconfirmed private fixture');
 return {status:'completed',candidates:72,saved:72};
}
