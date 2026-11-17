import {redirect} from "next/navigation";
import {currentPrivateReadStatus} from "../../../lib/auth/private-read";
import {DATA_ACTIVATION_POLICY} from '../../../lib/research/data-activation-policy';
import PrivatePage from './pilot';
export const dynamic="force-dynamic";
export default async function DailyPilot(){
 const status=await currentPrivateReadStatus();
 if(status===401)redirect("/sign-in");
 if(status!==200)return <main><h1>{status===403?"Owner access required":"Authorization unavailable"}</h1><p>Private TradeOS data is unavailable until owner access is verified.</p><a href="/sign-in">Sign in</a></main>;
 return <PrivatePage enabled={DATA_ACTIVATION_POLICY.dailyInvocation!==null}/>;
}
