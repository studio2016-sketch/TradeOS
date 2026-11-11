import test from "node:test";
import assert from "node:assert/strict";
import {parseFredHistoryCsv} from "../lib/market/fred-history-validation";
import {fredSeriesHistory,latestRegimeContext} from "../lib/market/fred";
import {addedOfficialMacroFactors,deriveOfficialMacroFactor,observedMacroEvidence} from "../lib/research/official-macro-evidence";

const asOf=new Date("2026-11-11T12:00:00Z");
const parse=(rows:string,header="observation_date,DGS10")=>parseFredHistoryCsv(`${header}\n${rows}`,"DGS10",asOf);
function rejected(result:{status:string;points:readonly unknown[]}){
  assert.equal(result.status,"error");
  assert.deepEqual(result.points,[]);
}

test("FRED preserves finite signed decimals, zero and explicit missing values in source-date order",()=>{
  assert.deepEqual(parse("2026-11-03,4.25\n2026-11-01,-0.5\n2026-11-02,0\n2026-11-04,.\n2026-11-05,"),{
    status:"ok",points:[{date:"2026-11-01",value:-0.5},{date:"2026-11-02",value:0},{date:"2026-11-03",value:4.25}]
  });
  assert.deepEqual(parse("2026-11-01,.\n2026-11-02,"),{status:"empty",points:[]});
  assert.deepEqual(parse(""),{status:"empty",points:[]});
  assert.deepEqual(parseFredHistoryCsv("\uFEFFDATE,DGS10\r\n2024-02-29,1.25e-2\r\n","DGS10",asOf),{
    status:"ok",points:[{date:"2024-02-29",value:0.0125}]
  });
});

test("FRED rejects wrong or ambiguous headers and successful HTTP error pages",()=>{
  for(const header of ["observation_date,DGS2","DATE,DGS10,EXTRA","date,DGS10","DGS10,observation_date","<html>Service unavailable</html>",""]){
    rejected(parse("2026-11-01,4",header));
  }
});

test("FRED rejects impossible, ambiguous and future dates including missing-value rows",()=>{
  for(const date of ["2026-02-30","2025-02-29","2026-13-01","2026-00-01","2026-04-31","2026-11-12","2099-01-01","2026-1-01","11/01/2026","2026-11-01T00:00:00Z"]){
    rejected(parse(`${date},4`));
    rejected(parse(`${date},.`));
  }
  rejected(parseFredHistoryCsv("DATE,DGS10\n2026-11-01,4","DGS10",new Date(NaN)));
  assert.equal(parse("2026-11-11,4").status,"ok");
});

test("FRED rejects duplicate dates instead of selecting a conflicting or repeated observation",()=>{
  for(const values of [["4","4"],["4","8"],[".","4"],[".","."]]){
    rejected(parse(`2026-11-01,${values[0]}\n2026-11-01,${values[1]}`));
  }
});

test("FRED rejects coercible nondecimal values, nonfinite values and malformed rows without partial history",()=>{
  for(const value of ["0x20","0b10","0o10","NaN","Infinity","-Infinity","1e999","1e-999","-1e-999","true","null","4x","1_000","1,000","1 000"]){
    rejected(parse(`2026-11-01,4\n2026-11-02,${value}`));
  }
  rejected(parse("2026-11-01,4\n2026-11-02"));
  rejected(parse("2026-11-01,4\n2026-11-02,5,extra"));
});

test("FRED fetch boundary validates requested identity and retains timeout, transport and missing diagnostics",async t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  let body="observation_date,DGS2\n2026-11-01,4";
  let status=200,calls=0;
  t.mock.method(globalThis,"fetch",async (url:unknown,init?:RequestInit)=>{
    calls++;
    const target=new URL(String(url));
    assert.equal(target.origin,"https://fred.stlouisfed.org");
    assert.equal(target.searchParams.get("id"),"DGS10");
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(init?.cache,"no-store");
    return new Response(body,{status});
  });
  rejected(await fredSeriesHistory("DGS10"));
  body="observation_date,DGS10\n2026-11-02,5\n2026-11-01,4";
  assert.deepEqual((await fredSeriesHistory("DGS10")).points,[{date:"2026-11-01",value:4},{date:"2026-11-02",value:5}]);
  body="observation_date,DGS10\n2026-11-01,.";
  assert.equal((await fredSeriesHistory("DGS10")).status,"empty");
  status=429;
  assert.match((await fredSeriesHistory("DGS10")).error??"",/HTTP 429/);
  const before=calls;
  for(const days of [0,-1,NaN,Infinity])assert.equal((await fredSeriesHistory("DGS10",days)).status,"error");
  assert.equal((await fredSeriesHistory("DGS10,OTHER")).status,"error");
  assert.equal(calls,before);
  t.mock.method(globalThis,"fetch",async()=>{throw new Error("transport unavailable")});
  assert.match((await fredSeriesHistory("DGS10")).error??"",/transport unavailable/);
});

test("FRED unsorted source rows cannot reverse latest macro or year-over-year selection",async t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  t.mock.method(globalThis,"fetch",async (url:unknown)=>{
    const id=new URL(String(url)).searchParams.get("id");
    return new Response(`observation_date,${id}\n2026-08-01,103\n2025-08-01,100\n2026-07-01,102`);
  });
  const definition=addedOfficialMacroFactors.find(x=>x.factor==="cpi_yoy")!;
  assert.deepEqual(deriveOfficialMacroFactor(definition,await fredSeriesHistory(definition.series,500)),{
    value:3.0000000000000027,observedAt:"2026-08-01",reason:null
  });
  const regime=await latestRegimeContext();
  assert.equal(regime.tenYear?.date,"2026-08-01");
  assert.equal(regime.tenYear?.value,103);
  assert.equal(regime.tenYear?.previous,102);
});

test("malformed FRED responses never become measured macro or DXY evidence",async t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  t.mock.method(globalThis,"fetch",async (url:unknown)=>{
    const id=new URL(String(url)).searchParams.get("id");
    return new Response(`observation_date,${id}\n2026-11-01,4\n2026-02-30,9`);
  });
  const result=await observedMacroEvidence();
  assert.deepEqual(result.factors,[]);
  assert.equal(result.measured,0);
  assert.equal(result.addedMeasured,0);
  assert.ok(result.addedFactors.every(f=>f.status==="unavailable"&&f.value===null));
  assert.equal(result.backtestEligible,false);
  assert.equal(result.approvedForTrading,false);
});


test("FRED regime change cannot expose nonfinite arithmetic from finite source values",async t=>{
  t.mock.timers.enable({apis:["Date"],now:asOf});
  t.mock.method(globalThis,"fetch",async (url:unknown)=>{
    const id=new URL(String(url)).searchParams.get("id");
    return new Response(`observation_date,${id}\n2026-11-01,-1e308\n2026-11-02,1e308`);
  });
  const regime=await latestRegimeContext();
  assert.equal(regime.tenYear?.value,1e308);
  assert.equal(regime.tenYear?.changePct,null);
  assert.ok(regime.diagnostics.every(row=>row.point?.changePct===null));
});
