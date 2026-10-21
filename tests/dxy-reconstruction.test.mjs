import test from "node:test";
import assert from "node:assert/strict";
import {reconstructDxy} from "../lib/research/official-macro-evidence.ts";

test("DXY reconstruction follows the published six-currency geometric formula",()=>{
 const base=reconstructDxy({eurusd:1,usdjpy:1,gbpusd:1,usdcad:1,usdsek:1,usdchf:1});
 assert.ok(base!==null);
 assert.ok(Math.abs(base-50.14348112)<1e-10);
 const weakerEuro=reconstructDxy({eurusd:.9,usdjpy:1,gbpusd:1,usdcad:1,usdsek:1,usdchf:1});
 assert.ok(weakerEuro!==null&&weakerEuro>base);
});
test("DXY reconstruction fails closed on invalid component rates",()=>{
 assert.equal(reconstructDxy({eurusd:0,usdjpy:1,gbpusd:1,usdcad:1,usdsek:1,usdchf:1}),null);
 assert.equal(reconstructDxy({eurusd:1,usdjpy:NaN,gbpusd:1,usdcad:1,usdsek:1,usdchf:1}),null);
});
