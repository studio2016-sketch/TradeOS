import {alpacaDailyHistory} from './market-factor-history';
import {runDailyFactorCollection} from './daily-factor-collection';
import {dailyFactorStore} from './daily-factor-store';

/** Prepared binding only. No route, schedule, default DB connection or top-level execution.
 * Production activation requires reviewed migration, connection permissions and operator scope.
 */
export async function runPreparedDailyFactorCollection(sql:any,clock=()=>new Date()){
 if((process.env.ALPACA_FEED||'iex')!=='iex')throw Error('daily_collection_requires_existing_iex_feed');
 return runDailyFactorCollection({...dailyFactorStore(sql,clock,true),clock,history:alpacaDailyHistory},true);
}
