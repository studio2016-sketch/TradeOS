import {NextResponse} from "next/server";
import {authorizeCron} from "../../../../lib/cron";
import {db,hasDatabase} from "../../../../lib/db";
export const dynamic="force-dynamic";
export const maxDuration=60;
type Check={provider:string;feed:string;status:number|null;outcome:string;observedAt:string|null;lagSeconds:number|null};
export async function GET(req:Request){
 if(!authorizeCron(req))return NextResponse.json({error:"unauthorized"},{status:401});
 const now=Date.now(),checks:Check[]=[];
 const a=process.env.ALPACA_API_KEY,s=process.env.ALPACA_API_SECRET,m=process.env.MASSIVE_API_KEY;
 const jobs=[
  ...["iex","sip","delayed_sip"].map(feed=>({provider:"Alpaca",feed,url:"https://data.alpaca.markets/v2/stocks/snapshots?symbols=SPY&feed="+feed,headers:{"APCA-API-KEY-ID":a??"","APCA-API-SECRET-KEY":s??""},configured:Boolean(a&&s)})),
  {provider:"Massive",feed:"stock_snapshot",url:"https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers/SPY?apiKey="+encodeURIComponent(m??""),headers:{},configured:Boolean(m)}
 ];
 for(const job of jobs){
  if(!job.configured){checks.push({provider:job.provider,feed:job.feed,status:null,outcome:"not_configured",observedAt:null,lagSeconds:null});continue;}
  try{
   const res=await fetch(job.url,{headers:job.headers,cache:"no-store",signal:AbortSignal.timeout(7000)});
   if(!res.ok){checks.push({provider:job.provider,feed:job.feed,status:res.status,outcome:res.status===403?"forbidden":res.status===401?"unauthorized":"http_error",observedAt:null,lagSeconds:null});continue;}
   const data=await res.json() as any;
   const x=job.provider==="Massive"?(data.ticker??data):data.SPY;
   const time=x?.latestTrade?.t??x?.lastTrade?.t??x?.minuteBar?.t??x?.min?.t??null;
   const raw=typeof time==="number"?(time>1e17?time/1e6:time>1e14?time/1e3:time):Date.parse(String(time??""));
   const valid=Number.isFinite(raw)&&raw>0;
   checks.push({provider:job.provider,feed:job.feed,status:res.status,outcome:valid?"returned_timestamped_market_data":"response_without_timestamp",observedAt:valid?new Date(raw).toISOString():null,lagSeconds:valid?Math.round((now-raw)/1000):null});
  }catch(e){checks.push({provider:job.provider,feed:job.feed,status:null,outcome:e instanceof Error&&e.name==="TimeoutError"?"timeout":"network_error",observedAt:null,lagSeconds:null});}
 }
 if(hasDatabase()){
  const sql=db();
  await sql`insert into tradeos_collector_runs(collector,status,received,saved,details) values('market_entitlement_audit','finished',${checks.length},0,${JSON.stringify({checks,checkedAt:new Date(now).toISOString(),note:"Snapshot access and freshness do not prove subscription entitlements or real-time streaming."})}::jsonb)`;
 }
 return NextResponse.json({checkedAt:new Date(now).toISOString(),checks,entitlementCertified:false,liveStreamingCertified:false},{headers:{"Cache-Control":"no-store"}});
}
