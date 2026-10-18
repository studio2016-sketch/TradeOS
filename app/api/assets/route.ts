import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const q=(new URL(req.url).searchParams.get("q")||"").trim().toUpperCase().slice(0,60);
 if(!process.env.ALPACA_API_KEY||!process.env.ALPACA_API_SECRET)return NextResponse.json({status:"unconfigured",assets:[],message:"Asset directory unavailable."},{headers:{"Cache-Control":"no-store"}});
 try{
  const endpoint=process.env.ALPACA_TRADING_ENV==="live"?"https://api.alpaca.markets":"https://paper-api.alpaca.markets";
  const r=await fetch(endpoint+"/v2/assets?status=active&asset_class=us_equity",{headers:{"APCA-API-KEY-ID":process.env.ALPACA_API_KEY,"APCA-API-SECRET-KEY":process.env.ALPACA_API_SECRET},next:{revalidate:3600},signal:AbortSignal.timeout(12000)});
  if(!r.ok)return NextResponse.json({status:"unavailable",assets:[],message:"Provider asset directory HTTP "+r.status},{status:502});
  const raw=await r.json() as any[];
  const assets=(Array.isArray(raw)?raw:[]).filter(x=>x.status==="active"&&x.asset_class==="us_equity"&&x.tradable===true&&typeof x.symbol==="string"&&/^[A-Z][A-Z0-9.-]{0,9}$/.test(x.symbol)).filter(x=>!q||x.symbol.includes(q)||String(x.name||"").toUpperCase().includes(q)).slice(0,100).map(x=>({symbol:x.symbol,name:String(x.name||""),exchange:String(x.exchange||""),fractionable:Boolean(x.fractionable)}));
  return NextResponse.json({status:"provider_directory",query:q,assets,limitedTo:100,scope:"Active tradable US equities supported by connected Alpaca account; not every global security.",asOf:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable",assets:[],message:"Provider asset directory request failed."},{status:502})}
}
