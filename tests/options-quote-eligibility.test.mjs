import test from "node:test";
import assert from "node:assert/strict";
import {optionQuoteEligibilityMaxAgeSeconds} from "../lib/market/options.ts";

test("OPRA option research requires five-minute quotes",()=>{
 assert.equal(optionQuoteEligibilityMaxAgeSeconds("opra"),300);
});
test("indicative option research can retain delayed timestamped observations without calling them live",()=>{
 assert.equal(optionQuoteEligibilityMaxAgeSeconds("indicative"),1200);
});
