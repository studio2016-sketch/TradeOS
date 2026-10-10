export interface OfficialSourceResult{
  id:string;
  label:string;
  status:"live"|"degraded"|"unconfigured";
  authoritative:boolean;
  generatedAt:string;
  data:any;
  note:string;
  error?:string;
}

function now(){return new Date().toISOString()}
function n(v:any){const x=Number(String(v??"").replace(/,/g,""));return Number.isFinite(x)?x:null}
function latest<T>(xs:T[],key:(x:T)=>string){return [...xs].sort((a,b)=>key(b).localeCompare(key(a)))[0]}

export async function cftcPositioning():Promise<OfficialSourceResult>{
  try{
    const url=new URL("https://publicreporting.cftc.gov/resource/yw9f-hn96.json");
    url.searchParams.set("$limit","250");
    url.searchParams.set("$order","report_date_as_yyyy_mm_dd DESC");
    const res=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"TradeOS/1.0"},cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const rows=await res.json() as any[];
    const wanted=/S&P|NASDAQ|RUSSELL|DOW|SOFR|EURODOLLAR|U\.S\. TREASURY|TREASURY|VIX|DOLLAR|EURO|YEN|BITCOIN/i;
    const filtered=rows.filter(r=>wanted.test(String(r.market_and_exchange_names||r.contract_market_name||r.commodity_name||""))).slice(0,80);
    const data=filtered.map(r=>{
      const oi=n(r.open_interest_all);
      const dealerLong=n(r.dealer_positions_long_all),dealerShort=n(r.dealer_positions_short_all);
      const assetLong=n(r.asset_mgr_positions_long),assetShort=n(r.asset_mgr_positions_short);
      const levLong=n(r.lev_money_positions_long_all),levShort=n(r.lev_money_positions_short_all);
      const pct=(a:number|null,b:number|null)=>oi&&a!=null&&b!=null?+(((a-b)/oi)*100).toFixed(2):null;
      return{
        date:String(r.report_date_as_yyyy_mm_dd||""),market:String(r.market_and_exchange_names||r.contract_market_name||""),
        commodity:String(r.commodity_name||""),openInterest:oi,
        dealerNetPct:pct(dealerLong,dealerShort),assetManagerNetPct:pct(assetLong,assetShort),leveragedMoneyNetPct:pct(levLong,levShort)
      };
    });
    return{id:"cftc",label:"CFTC Traders in Financial Futures",status:data.length?"live":"degraded",authoritative:true,generatedAt:now(),data,note:"Official weekly futures/options positioning; dealer, asset-manager and leveraged-money classifications."};
  }catch(error){return{id:"cftc",label:"CFTC Traders in Financial Futures",status:"degraded",authoritative:true,generatedAt:now(),data:[],note:"Official CFTC positioning feed.",error:error instanceof Error?error.message:String(error)}}
}

async function finraPost(dataset:string,body:any){
  const res=await fetch(`https://api.finra.org/data/group/otcMarket/name/${dataset}`,{
    method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","Data-API-Version":"1"},
    body:JSON.stringify(body),cache:"no-store"
  });
  if(!res.ok)throw new Error(`FINRA ${dataset} HTTP ${res.status}`);
  return await res.json() as any[];
}

export async function finraEquityContext(symbols:string[]):Promise<OfficialSourceResult>{
  try{
    const clean=[...new Set(symbols.map(s=>s.toUpperCase()).filter(s=>/^[A-Z0-9.-]{1,10}$/.test(s)))].slice(0,20);
    const [regSho,shortInterest]=await Promise.all([
      finraPost("regShoDaily",{
        limit:500,
        fields:["tradeReportDate","securitiesInformationProcessorSymbolIdentifier","shortParQuantity","shortExemptParQuantity","totalParQuantity","reportingFacilityCode"],
        domainFilters:clean.length?[{fieldName:"securitiesInformationProcessorSymbolIdentifier",values:clean}]:undefined
      }).catch(()=>[]),
      finraPost("consolidatedShortInterest",{
        limit:250,
        fields:["settlementDate","symbolCode","currentShortPositionQuantity","previousShortPositionQuantity","averageDailyVolumeQuantity","daysToCoverQuantity","changePercent"],
        domainFilters:clean.length?[{fieldName:"symbolCode",values:clean}]:undefined
      }).catch(()=>[])
    ]);
    const regBy=new Map<string,any[]>();
    for(const r of regSho){const s=String(r.securitiesInformationProcessorSymbolIdentifier||"");regBy.set(s,[...(regBy.get(s)||[]),r]);}
    const out=clean.map(symbol=>{
      const rr=regBy.get(symbol)||[];
      const short=rr.reduce((a,r)=>a+(n(r.shortParQuantity)||0),0);
      const exempt=rr.reduce((a,r)=>a+(n(r.shortExemptParQuantity)||0),0);
      const total=rr.reduce((a,r)=>a+(n(r.totalParQuantity)||0),0);
      const si=latest(shortInterest.filter(r=>String(r.symbolCode||"")===symbol),r=>String(r.settlementDate||""));
      return{
        symbol,regShoDate:String(rr[0]?.tradeReportDate||""),shortVolume:short,shortExemptVolume:exempt,totalVolume:total,
        shortVolumeRatio:total?+((short/total)*100).toFixed(2):null,
        shortInterest:si?{settlementDate:si.settlementDate,current:n(si.currentShortPositionQuantity),previous:n(si.previousShortPositionQuantity),daysToCover:n(si.daysToCoverQuantity),changePercent:n(si.changePercent)}:null
      };
    });
    const usable=regSho.length||shortInterest.length;
    return{id:"finra",label:"FINRA Reg SHO + Consolidated Short Interest",status:usable?"live":"degraded",authoritative:true,generatedAt:now(),data:out,note:"Official off-exchange short-sale volume and consolidated short-interest context."};
  }catch(error){return{id:"finra",label:"FINRA Reg SHO + Consolidated Short Interest",status:"degraded",authoritative:true,generatedAt:now(),data:[],note:"Official FINRA equity transparency feed.",error:error instanceof Error?error.message:String(error)}}
}

export async function treasuryYieldCurve():Promise<OfficialSourceResult>{
  try{
    const year=new Date().getUTCFullYear();
    const url=`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
    const res=await fetch(url,{headers:{"Accept":"application/xml,text/xml","User-Agent":"TradeOS/1.0"},cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const xml=await res.text();
    const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m=>m[1]);
    const parse=(body:string,name:string)=>{const m=body.match(new RegExp(`<d:${name}[^>]*>([^<]+)<\\/d:${name}>`,"i"));return m?n(m[1]):null};
    const rows=entries.map(body=>{
      const dm=body.match(/<d:NEW_DATE[^>]*>([^<]+)<\/d:NEW_DATE>/i);
      return{date:dm?.[1]??"",m1:parse(body,"BC_1MONTH"),m3:parse(body,"BC_3MONTH"),m6:parse(body,"BC_6MONTH"),y1:parse(body,"BC_1YEAR"),y2:parse(body,"BC_2YEAR"),y5:parse(body,"BC_5YEAR"),y10:parse(body,"BC_10YEAR"),y20:parse(body,"BC_20YEAR"),y30:parse(body,"BC_30YEAR")};
    }).filter(x=>x.date);
    const row=rows[rows.length-1]??null;
    const curve10y2y=row?.y10!=null&&row?.y2!=null?+(row.y10-row.y2).toFixed(3):null;
    return{id:"treasury",label:"U.S. Treasury Yield Curve",status:row?"live":"degraded",authoritative:true,generatedAt:now(),data:row?{...row,curve10y2y}:null,note:"Official Treasury daily par-yield curve; independent confirmation of rate regime."};
  }catch(error){return{id:"treasury",label:"U.S. Treasury Yield Curve",status:"degraded",authoritative:true,generatedAt:now(),data:null,note:"Official Treasury yield-curve feed.",error:error instanceof Error?error.message:String(error)}}
}

const BLS_SERIES=[
  ["CUUR0000SA0","CPI"],
  ["WPUFD4","PPI Final Demand"],
  ["LNS14000000","Unemployment Rate"],
  ["CES0000000001","Nonfarm Payrolls"],
  ["CES0500000003","Average Hourly Earnings"],
  ["JTS000000000000000JOL","Job Openings"]
] as const;

export async function blsSeriesContext():Promise<OfficialSourceResult>{
  try{
    const ids=BLS_SERIES.map(x=>x[0]);
    const res=await fetch("https://api.bls.gov/publicAPI/v1/timeseries/data/",{
      method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({seriesid:ids}),cache:"no-store"
    });
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const json=await res.json() as any;
    const series=(json?.Results?.series??[]).map((s:any)=>{
      const label=BLS_SERIES.find(x=>x[0]===s.seriesID)?.[1]??s.seriesID;
      const rows=(s.data??[]).filter((x:any)=>/^M(0[1-9]|1[0-2])$/.test(String(x.period))).slice(0,14);
      const latest=rows[0],prev=rows[1];
      const lv=n(latest?.value),pv=n(prev?.value);
      return{id:s.seriesID,label,period:latest?`${latest.year}-${latest.period}`:null,value:lv,previous:pv,change:lv!=null&&pv!=null?+(lv-pv).toFixed(4):null};
    });
    return{id:"bls-data",label:"BLS Economic Series",status:series.length?"live":"degraded",authoritative:true,generatedAt:now(),data:series,note:"Official CPI, PPI, payroll, unemployment, wage and job-openings series via the keyless BLS public API."};
  }catch(error){return{id:"bls-data",label:"BLS Economic Series",status:"degraded",authoritative:true,generatedAt:now(),data:[],note:"Official BLS series feed.",error:error instanceof Error?error.message:String(error)}}
}

export async function cboeOptionsStats():Promise<OfficialSourceResult>{
  try{
    const res=await fetch("https://www.cboe.com/us/options/market_statistics/daily/",{headers:{"User-Agent":"TradeOS/1.0","Accept":"text/html"},cache:"no-store"});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const html=await res.text();
    const text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ");
    const get=(name:string)=>{
      const re=new RegExp(name.replace(/[.*+?^$()|[\]\\]/g,"\\$&")+"\\s*([0-9]+(?:\\.[0-9]+)?)","i");
      const m=text.match(re);return m?n(m[1]):null;
    };
    const data={totalPutCall:get("TOTAL PUT/CALL RATIO"),indexPutCall:get("INDEX PUT/CALL RATIO"),etpPutCall:get("EXCHANGE TRADED PRODUCTS PUT/CALL RATIO"),equityPutCall:get("EQUITY PUT/CALL RATIO"),vixPutCall:get("CBOE VOLATILITY INDEX (VIX) PUT/CALL RATIO"),spxPutCall:get("SPX + SPXW PUT/CALL RATIO")};
    const usable=Object.values(data).some(v=>v!=null);
    return{id:"cboe",label:"Cboe Options Market Statistics",status:usable?"live":"degraded",authoritative:true,generatedAt:now(),data,note:"Official Cboe aggregate options put/call statistics; market context, not contract-level OPRA data."};
  }catch(error){return{id:"cboe",label:"Cboe Options Market Statistics",status:"degraded",authoritative:true,generatedAt:now(),data:null,note:"Official Cboe options-statistics page.",error:error instanceof Error?error.message:String(error)}}
}

export async function fredVintageContext():Promise<OfficialSourceResult>{
  const key=process.env.FRED_API_KEY;
  if(!key)return{id:"alfred",label:"FRED / ALFRED Vintage Data",status:"unconfigured",authoritative:true,generatedAt:now(),data:null,note:"Free FRED API key required for vintage/revision-aware macro backtesting."};
  try{
    const series=["GDP","GDPC1","CPIAUCSL","PAYEMS","UNRATE"];
    const out:any[]=[];
    for(const id of series){
      const url=new URL("https://api.stlouisfed.org/fred/series/observations");
      url.searchParams.set("series_id",id);url.searchParams.set("api_key",key);url.searchParams.set("file_type","json");url.searchParams.set("output_type","4");
      const res=await fetch(url,{cache:"no-store"});if(!res.ok)throw new Error(`${id} HTTP ${res.status}`);
      const j=await res.json() as any; const obs=(j.observations??[]).filter((x:any)=>x.value!==".");
      out.push({series:id,initialReleases:obs.slice(-24)});
    }
    return{id:"alfred",label:"FRED / ALFRED Vintage Data",status:"live",authoritative:true,generatedAt:now(),data:out,note:"Initial-release/vintage-aware macro data for look-ahead-safe historical testing."};
  }catch(error){return{id:"alfred",label:"FRED / ALFRED Vintage Data",status:"degraded",authoritative:true,generatedAt:now(),data:null,note:"Vintage-aware FRED/ALFRED feed.",error:error instanceof Error?error.message:String(error)}}
}

export async function beaContext():Promise<OfficialSourceResult>{
  const key=process.env.BEA_API_KEY;
  if(!key)return{id:"bea",label:"BEA Economic Data",status:"unconfigured",authoritative:true,generatedAt:now(),data:null,note:"Free BEA API key required; adapter ready for GDP, income and industry data."};
  try{
    const url=new URL("https://apps.bea.gov/api/data");
    Object.entries({UserID:key,method:"GetData",datasetname:"NIPA",TableName:"T10101",Frequency:"Q",Year:"X",ResultFormat:"JSON"}).forEach(([k,v])=>url.searchParams.set(k,v));
    const res=await fetch(url,{cache:"no-store"});if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const j=await res.json() as any;
    const rows=j?.BEAAPI?.Results?.Data??[];
    return{id:"bea",label:"BEA Economic Data",status:rows.length?"live":"degraded",authoritative:true,generatedAt:now(),data:rows.slice(0,20),note:"Official BEA GDP and national-account context."};
  }catch(error){return{id:"bea",label:"BEA Economic Data",status:"degraded",authoritative:true,generatedAt:now(),data:null,note:"Official BEA economic feed.",error:error instanceof Error?error.message:String(error)}}
}

export async function eiaContext():Promise<OfficialSourceResult>{
  const key=process.env.EIA_API_KEY;
  if(!key)return{id:"eia",label:"EIA Energy Data",status:"unconfigured",authoritative:true,generatedAt:now(),data:null,note:"Free EIA API key required; adapter ready for petroleum and energy fundamentals."};
  try{
    const url=new URL("https://api.eia.gov/v2/petroleum/stoc/wstk/data/");
    url.searchParams.set("api_key",key);url.searchParams.set("length","12");url.searchParams.set("sort[0][column]","period");url.searchParams.set("sort[0][direction]","desc");
    const res=await fetch(url,{cache:"no-store"});if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const j=await res.json() as any;
    return{id:"eia",label:"EIA Energy Data",status:"live",authoritative:true,generatedAt:now(),data:j?.response?.data??[],note:"Official EIA weekly petroleum-stock context."};
  }catch(error){return{id:"eia",label:"EIA Energy Data",status:"degraded",authoritative:true,generatedAt:now(),data:null,note:"Official EIA energy feed.",error:error instanceof Error?error.message:String(error)}}
}

export async function freeOfficialSnapshot(symbols:string[]){
  const [cftc,finra,treasury,bls,cboe,alfred,bea,eia]=await Promise.all([
    cftcPositioning(),finraEquityContext(symbols),treasuryYieldCurve(),blsSeriesContext(),cboeOptionsStats(),fredVintageContext(),beaContext(),eiaContext()
  ]);
  const sources=[cftc,finra,treasury,bls,cboe,alfred,bea,eia];
  return{generatedAt:now(),sources,live:sources.filter(x=>x.status==="live").length,degraded:sources.filter(x=>x.status==="degraded").length,unconfigured:sources.filter(x=>x.status==="unconfigured").length};
}
