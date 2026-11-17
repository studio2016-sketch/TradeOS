import {DATA_ACTIVATION_POLICY} from '../../../lib/research/data-activation-policy';
import Pilot from './pilot';
export const dynamic='force-dynamic';
export default function DailyPilot(){return <Pilot enabled={DATA_ACTIVATION_POLICY.dailyInvocation!==null}/>;}
