import test from "node:test";
import assert from "node:assert/strict";
import {officialNumber,officialCount,sumOfficialCounts} from "../lib/market/official-numeric-validation";
import {blsSeriesContext,cftcPositioning,finraEquityContext,treasuryYieldCurve} from "../lib/market/freeOfficial";
import {evaluateInstitutionalLens} from "../lib/research/institutionalLens";

const cftcRow={report_date_as_yyyy_mm_dd:"2026-11-01",market_and_exchange_names:"S&P",open_interest_all:"1,000"};
const regRow={tradeReportDate:"2026-11-01",securitiesInformationProcessorSymbolIdentifier:"SPY",shortParQuantity:"20",shortExemptParQuantity:"0",totalParQuantity:"100"};
const blsResponse=(data:unknown[])=>({status:"REQUEST_SUCCEEDED",Results:{series:[{seriesID:"CUUR0000SA0",data}]}});
const month=(period:string,value:unknown)=>({year:"2026",period,value});

function mockFinra(t:any,reg:unknown[],si:unknown[]=[]){
  t.mock.method(globalThis,"fetch",async (url:unknown)=>Response.json(String(url).endsWith("/regShoDaily")?reg:si));
}

test("official number parsing preserves measured zero and strict decimal/grouped values",()=>{
  for(const [input,expected] of [[0,0],["0",0],[" 0.0 ",0],["1,234.50",1234.5],["-1,234",-1234],["2.5e2",250],[".25",.25],["-0.5",-.5]] as const){
    assert.equal(officialNumber(input),expected);
  }
  for(const value of [undefined,null,""," ",".","N/A",true,false,[],[0],{},"1,43","12,34,567","0x20","1_000","1e999","1e-999",Infinity,NaN]){
    assert.equal(officialNumber(value),null,String(value));
  }
});

test("official counts require complete nonnegative safe integers and never fill missing facilities with zero",()=>{
  for(const value of [-1,"-1",.5,"1.5",Number.MAX_SAFE_INTEGER+1,"1.0000000000000001","9007199254740991.1"])assert.equal(officialCount(value),null);
  assert.equal(officialCount("1,000"),1000);
  assert.equal(officialCount("1.00e3"),1000);
  assert.equal(officialCount("90071992547409910e-1"),Number.MAX_SAFE_INTEGER);
  assert.equal(sumOfficialCounts([],"count"),null);
  assert.equal(sumOfficialCounts([{count:0},{count:"0"}],"count"),0);
  assert.equal(sumOfficialCounts([{count:12},{count:"34"}],"count"),46);
  assert.equal(sumOfficialCounts([{count:12},{}],"count"),null);
  assert.equal(sumOfficialCounts([{count:Number.MAX_SAFE_INTEGER},{count:1}],"count"),null);
});

test("BLS empty or missing latest readings remain unavailable rather than live zero inflation",async t=>{
  let data:unknown[]=[];
  t.mock.method(globalThis,"fetch",async()=>Response.json(blsResponse(data)));
  let result=await blsSeriesContext();
  assert.equal(result.status,"degraded");
  assert.deepEqual(result.data[0],{id:"CUUR0000SA0",label:"CPI",period:null,value:null,previous:null,change:null});
  data=[month("M10",null),month("M09","300")];
  result=await blsSeriesContext();
  assert.equal(result.status,"degraded");
  assert.equal(result.data[0].value,null);
  assert.equal(result.data[0].previous,300);
  assert.equal(result.data[0].change,null);
});

test("BLS measured zero is preserved and missing comparison values are not invented",async t=>{
  let data=[month("M10","0"),month("M09","1")];
  t.mock.method(globalThis,"fetch",async()=>Response.json(blsResponse(data)));
  let result=await blsSeriesContext();
  assert.equal(result.status,"live");
  assert.equal(result.data[0].value,0);
  assert.equal(result.data[0].change,-1);
  data=[month("M10","0")];
  result=await blsSeriesContext();
  assert.equal(result.data[0].previous,null);
  assert.equal(result.data[0].change,null);
});

test("BLS unsuccessful response and nonfinite derived differences fail closed",async t=>{
  t.mock.method(globalThis,"fetch",async()=>Response.json({...blsResponse([month("M10","3")]),status:"REQUEST_FAILED"}));
  assert.equal((await blsSeriesContext()).status,"degraded");
  t.mock.method(globalThis,"fetch",async()=>Response.json(blsResponse([month("M10","1e308"),month("M09","-1e308")])));
  assert.equal((await blsSeriesContext()).data[0].change,null);
});

test("CFTC missing positioning stays missing through downstream institutional evaluation",async t=>{
  t.mock.method(globalThis,"fetch",async()=>Response.json([cftcRow]));
  const result=await cftcPositioning();
  assert.equal(result.data[0].openInterest,1000);
  for(const field of ["dealerNetPct","assetManagerNetPct","leveragedMoneyNetPct"])assert.equal(result.data[0][field],null);
  const lens=evaluateInstitutionalLens("SPY",{official:{sources:[result]}});
  const cross=lens.playbooks.find(row=>row.id==="cross-asset-confirmation")!;
  assert.equal(cross.score,null);
  assert.equal(cross.state,"unavailable");
  assert.ok(cross.evidence.includes("CFTC leveraged-money net n/a"));
  assert.equal(lens.observed,0);
  assert.equal(lens.score,null);
  assert.equal(lens.safety.ordersAllowed,false);
});

test("CFTC actual neutral positions remain measured and malformed or negative counts are not accepted",async t=>{
  let row={...cftcRow,lev_money_positions_long_all:"0",lev_money_positions_short_all:"0"};
  t.mock.method(globalThis,"fetch",async()=>Response.json([row]));
  let result=await cftcPositioning();
  assert.equal(result.data[0].leveragedMoneyNetPct,0);
  let cross=evaluateInstitutionalLens("SPY",{official:{sources:[result]}}).playbooks.find(row=>row.id==="cross-asset-confirmation")!;
  assert.equal(cross.score,50);
  assert.ok(cross.evidence.includes("CFTC leveraged-money net 0.00% of OI"));
  for(const value of ["1,43","-1","0.5"]){
    row={...row,lev_money_positions_long_all:value};
    result=await cftcPositioning();
    assert.equal(result.data[0].leveragedMoneyNetPct,null);
  }
});

test("FINRA absent symbol observations do not fabricate zero short volume",async t=>{
  mockFinra(t,[]);
  const result=await finraEquityContext(["SPY"]);
  assert.equal(result.status,"degraded");
  assert.equal(result.data[0].shortVolume,null);
  assert.equal(result.data[0].shortExemptVolume,null);
  assert.equal(result.data[0].totalVolume,null);
  assert.equal(result.data[0].shortVolumeRatio,null);
});

test("FINRA valid facility counts aggregate, but incomplete numerator or denominator remains unknown",async t=>{
  mockFinra(t,[regRow,{...regRow,reportingFacilityCode:"OTHER",shortParQuantity:"30",totalParQuantity:"100"}]);
  let result=await finraEquityContext(["SPY"]);
  assert.equal(result.data[0].shortVolume,50);
  assert.equal(result.data[0].totalVolume,200);
  assert.equal(result.data[0].shortVolumeRatio,25);
  mockFinra(t,[regRow,{...regRow,shortParQuantity:null}]);
  result=await finraEquityContext(["SPY"]);
  assert.equal(result.data[0].shortVolume,null);
  assert.equal(result.data[0].totalVolume,200);
  assert.equal(result.data[0].shortVolumeRatio,null);
  mockFinra(t,[{...regRow,totalParQuantity:""}]);
  result=await finraEquityContext(["SPY"]);
  assert.equal(result.data[0].totalVolume,null);
  assert.equal(result.data[0].shortVolumeRatio,null);
});

test("FINRA actual zero counts remain measured, while malformed short-interest fields stay null",async t=>{
  mockFinra(t,[{...regRow,shortParQuantity:"0"}], [{symbolCode:"SPY",settlementDate:"2026-10-30",currentShortPositionQuantity:null,previousShortPositionQuantity:"0",daysToCoverQuantity:"",changePercent:"1,43"}]);
  const result=await finraEquityContext(["SPY"]);
  assert.equal(result.data[0].shortVolume,0);
  assert.equal(result.data[0].shortVolumeRatio,0);
  assert.deepEqual(result.data[0].shortInterest,{settlementDate:"2026-10-30",current:null,previous:0,daysToCover:null,changePercent:null});
});

test("FINRA numeric invalidity and overflow cannot produce a plausible ratio",async t=>{
  for(const patch of [{shortParQuantity:"-1"},{shortParQuantity:"1,43"},{shortParQuantity:"0.5"},{shortParQuantity:"101"},{totalParQuantity:"0"}]){
    mockFinra(t,[{...regRow,...patch}]);
    assert.equal((await finraEquityContext(["SPY"])).data[0].shortVolumeRatio,null);
  }
  mockFinra(t,[{...regRow,totalParQuantity:String(Number.MAX_SAFE_INTEGER)},{...regRow,totalParQuantity:"1"}]);
  assert.equal((await finraEquityContext(["SPY"])).data[0].totalVolume,null);
});

test("Treasury blank numeric fields and overflowing spreads never become synthetic yields",async t=>{
  let y10=" ",y2="2";
  t.mock.method(globalThis,"fetch",async()=>new Response(`<feed><entry><d:NEW_DATE>2026-11-01</d:NEW_DATE><d:BC_10YEAR>${y10}</d:BC_10YEAR><d:BC_2YEAR>${y2}</d:BC_2YEAR></entry></feed>`));
  let result=await treasuryYieldCurve();
  assert.equal(result.data.y10,null);
  assert.equal(result.data.curve10y2y,null);
  y10="0";
  result=await treasuryYieldCurve();
  assert.equal(result.data.y10,0);
  assert.equal(result.data.curve10y2y,-2);
  y10="1e308";y2="-1e308";
  assert.equal((await treasuryYieldCurve()).data.curve10y2y,null);
});

test("institutional averages ignore missing/nonfinite inputs but retain measured zero",()=>{
  let lens=evaluateInstitutionalLens("SPY",{features:{structure:{anchoredVwapScore:80,reclaimHoldScore:null,confirmationScore:undefined},intraday:{vwapHoldScore:Infinity}}});
  assert.equal(lens.playbooks.find(row=>row.id==="vwap-acceptance")?.score,80);
  lens=evaluateInstitutionalLens("SPY",{features:{structure:{anchoredVwapScore:0,reclaimHoldScore:null}}});
  assert.equal(lens.playbooks.find(row=>row.id==="vwap-acceptance")?.score,0);
  lens=evaluateInstitutionalLens("SPY",{});
  assert.equal(lens.observed,0);
  assert.equal(lens.score,null);
  assert.ok(lens.playbooks.every(row=>row.state==="unavailable"&&row.score===null));
});
