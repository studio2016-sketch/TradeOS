import type {observedIntradayActivationEvidence} from './intraday-activation-evidence';
import type {persistEvidence} from './persist-evidence';
import type {persistIntradayWithExactSlippage} from './intraday-exact-persistence';
export class IntradayRunFailure extends Error{
 constructor(public readonly received:number,public readonly persistenceAttempted:boolean,public readonly original:unknown){super('intraday_'+(persistenceAttempted?'persistence_outcome_uncertain':'collection_failed'));}
}
export async function runIntradayIngestion(deps:{collect:typeof observedIntradayActivationEvidence;legacy:typeof persistEvidence;
 exact:typeof persistIntradayWithExactSlippage;sql:()=>any;preflight:()=>Promise<void>;clock:()=>Date},exactWrites:boolean){
 let received=0,persistenceAttempted=false;
 try{
  if(exactWrites)await deps.preflight();
  const data=await deps.collect();received=data.candidates.length;
  persistenceAttempted=true;
  const persisted=exactWrites?await deps.exact(deps.sql(),data.candidates,deps.clock()):await deps.legacy(data.candidates);
  return {data,persisted,storagePolicy:exactWrites?'exact_slippage_and_legacy_other_factors':'legacy_microseconds'};
 }catch(error){throw new IntradayRunFailure(received,persistenceAttempted,error);}
}
