import test from "node:test";
import assert from "node:assert/strict";
import {addedOfficialMacroFactors,deriveOfficialMacroFactor} from "../lib/research/official-macro-evidence.ts";
import {FACTOR_KEYS} from "../lib/research/acceleration-factors.ts";

test("registers exactly ten new official macro factors in the canonical catalog",()=>{
 assert.equal(addedOfficialMacroFactors.length,10);
 assert.equal(new Set(addedOfficialMacroFactors.map(x=>x.factor)).size,10);
 for(const factor of addedOfficialMacroFactors)assert.ok(FACTOR_KEYS.some(key=>key===factor.factor),factor.factor);
});

test("derives a year-over-year factor only from matching current and prior-year months",()=>{
 const definition=addedOfficialMacroFactors.find(x=>x.factor==="cpi_yoy")!;
 const result=deriveOfficialMacroFactor(definition,{series:definition.series,status:"ok",points:[
  {date:"2025-08-01",value:100},
  {date:"2025-09-01",value:101},
  {date:"2026-08-01",value:103}
 ]});
 assert.equal(result.observedAt,"2026-08-01");
 assert.ok(result.value!==null&&Math.abs(result.value-3)<1e-10);
});

test("fails closed when the prior-year comparison is missing",()=>{
 const definition=addedOfficialMacroFactors.find(x=>x.factor==="core_cpi")!;
 const result=deriveOfficialMacroFactor(definition,{series:definition.series,status:"ok",points:[{date:"2026-08-01",value:103}]});
 assert.equal(result.value,null);
 assert.equal(result.reason,"missing_prior_year_observation");
});

test("passes through a valid latest observation with its source date",()=>{
 const definition=addedOfficialMacroFactors.find(x=>x.factor==="real_yield")!;
 const result=deriveOfficialMacroFactor(definition,{series:definition.series,status:"ok",points:[{date:"2026-10-20",value:1.74}]});
 assert.deepEqual(result,{value:1.74,observedAt:"2026-10-20",reason:null});
});
