import {authorizeCron} from '../../../../lib/cron';
import {db} from '../../../../lib/db';
import {scheduledDailyCollection} from '../../../../lib/research/scheduled-daily-collection';
import {dailyRequestBudget} from '../../../../lib/research/daily-request-budget';
import {assertDataStorageReady} from '../../../../lib/research/data-storage-readiness';
import {runPreparedDailyFactorCollection} from '../../../../lib/research/daily-factor-runner';
export const dynamic='force-dynamic';
export const maxDuration=120;
export const GET=scheduledDailyCollection({
 authorize:authorizeCron,clock:()=>new Date(),
 execute:async clock=>{
  const budget=dailyRequestBudget();
  return budget.run(async()=>{
   const driver=db();
   budget.requireRunBudget();
   await assertDataStorageReady(budget.sql(driver,true),'daily');
   budget.requireRunBudget();
   return runPreparedDailyFactorCollection(budget.sql(driver),()=>{budget.clock();return clock();});
  });
 },
});
