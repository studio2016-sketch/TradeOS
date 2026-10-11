import {NextResponse} from "next/server";
import {fredVintageContext,beaContext,eiaContext} from "../../../lib/market/freeOfficial";
import {bestSnapshots} from "../../../lib/market/live";
export const dynamic="force-dynamic";
export async function GET(){
 const started=Date.now();
 const ids=["fred","bea","eia","massive","alpaca"];
 const status:Record<string,any>={};
 const safe=async(id:string,fn:()=>Promise<any>)=>{
  const t=Date.now();
  try{const r=await fn();status[id]={configured:true,verified:r.status==="live"&&Boolean(r.data)&&(!Array.isArray(r.data)||r.data.length>0),sourceStatus:r.status,rows:Array.isArray(r.data)?r.data.length:null,latencyMs:Date.now()-t,reason:r.error?String(r.error).slice(0,150):r.note};}
  catch(e){status[id]={configured:true,verified:false,latencyMs:Date.now()-t,reason:e instanceof Error?e.message.slice(0,150):"Provider error"};}
 };
 await Promise.all([
  process.env.FRED_API_KEY?safe("fred",fredVintageContext):Promise.resolve(status.fred={configured:false,verified:false,reason:"Missing key"}),
  process.env.BEA_API_KEY?safe("bea",beaContext):Promise.resolve(status.bea={configured:false,verified:false,reason:"Missing key"}),
  process.env.EIA_API_KEY?safe("eia",eiaContext):Promise.resolve(status.eia={configured:false,verified:false,reason:"Missing key"}),
  (process.env.ALPACA_API_KEY&&process.env.ALPACA_API_SECRET)?safe("alpaca",async()=>{const {alpacaSnapshots}=await import("../../../lib/market/live");const a=await alpacaSnapshots(["SPY"]);return {status:a.length&&a.some(s=>s.price>0&&Number.isFinite(Date.parse(s.timestamp)))?"live":"degraded",data:a,note:"One symbol price received. This does not prove real-time SIP entitlement."};}):Promise.resolve(status.alpaca={configured:false,verified:false,reason:"Missing key"}),
  process.env.MASSIVE_API_KEY?safe("massive",async()=>{const {massiveSnapshots}=await import("../../../lib/market/live");const a=await massiveSnapshots(["SPY"]);return {status:a.length&&a.some(s=>s.price>0)?"live":"degraded",data:a,note:"Snapshot request. Massive free tiers may not allow this endpoint; historical free-tier access is a separate test."};}):Promise.resolve(status.massive={configured:false,verified:false,reason:"Missing key"})
 ]);
 return NextResponse.json({checkedAt:new Date().toISOString(),elapsedMs:Date.now()-started,providers:ids.map(id=>({id,...status[id]})),disclaimer:"Probe success establishes only a valid upstream response, not a real-time feed, historical accuracy, or entitlement to redistribute data."},{headers:{"Cache-Control":"no-store"}});
}
