import test from "node:test";
import assert from "node:assert/strict";
import {alignedCashflowYield} from "../lib/research/aligned-cashflow-yield.ts";
const provenance={start:"2025-01-01",end:"2025-12-31",filed:"2026-02-01",accession:"0001-26-000001"};
const input=(value:number)=>({value,provenance:{...provenance}});
test("same annual filing yields independently calculated cash flow ratio",()=>{
 const result=alignedCashflowYield(input(150),input(40),1000);
 assert.equal(result?.freeCashFlow,110);
 assert.equal(result?.value,.11);
 assert.equal(result?.periodStart,"2025-01-01");
 assert.equal(alignedCashflowYield(input(150),input(-40),1000)?.value,.11);
 assert.equal(alignedCashflowYield(input(-10),input(40),1000)?.value,-.05);
 assert.equal(alignedCashflowYield(input(150),input(0),1000)?.value,.15);
});
test("historical capex cannot be subtracted from current-year operating cash flow",()=>{
 const capex=input(40);
 capex.provenance={start:"2011-01-31",end:"2012-01-29",filed:"2012-02-20",accession:"old"};
 assert.equal(alignedCashflowYield(input(150),capex,1000),null);
 for(const change of [{start:"2025-01-02"},{end:"2025-12-30"},{accession:"different"},{filed:"2026-02-02"}]){
  assert.equal(alignedCashflowYield(input(150),{value:40,provenance:{...provenance,...change}},1000),null);
 }
});
test("missing, invalid, nonannual and nonfinite inputs fail closed",()=>{
 assert.equal(alignedCashflowYield(input(150),{value:40},1000),null);
 for(const bad of [{start:undefined},{start:"2025-02-30"},{start:"2025-10-01"},{end:"2024-12-31"},{filed:"2025-11-01"},{accession:""}]){
  const p={...provenance,...bad};
  assert.equal(alignedCashflowYield({value:150,provenance:p},{value:40,provenance:p},1000),null);
 }
 for(const value of [NaN,Infinity,-Infinity]){
  assert.equal(alignedCashflowYield(input(value),input(40),1000),null);
  assert.equal(alignedCashflowYield(input(150),input(value),1000),null);
 }
 for(const marketCap of [0,-1,NaN,Infinity])assert.equal(alignedCashflowYield(input(150),input(40),marketCap),null);
 assert.equal(alignedCashflowYield(input(150),input(40),Number.MIN_VALUE),null);
});
