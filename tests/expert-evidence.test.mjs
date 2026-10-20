import test from "node:test";
import assert from "node:assert/strict";
import {countDocumentedSupport,expertEvidence} from "../lib/research/expert-evidence.ts";
const cohort=Array.from({length:20},(_,i)=>"Expert "+i);
test("a source lead is not sufficient for 85 percent consensus",()=>{
 const votes=expertEvidence.map(x=>({expert:x.expert,principle:x.principle,stance:x.stance,source:x.source}));
 assert.equal(countDocumentedSupport("RISK_CYCLES",cohort,votes).verified85Percent,false);
});
test("duplicate expert records do not inflate the count",()=>{
 const votes=Array.from({length:25},()=>({expert:"Expert 0",principle:"RISK",stance:"supports",source:"https://example.org"}));
 assert.equal(countDocumentedSupport("RISK",cohort,votes).supporters,1);
});
test("unsupported opinions and uncertain attribution never count",()=>{
 const votes=[{expert:"Expert 0",principle:"RISK",stance:"unknown",source:"https://example.org"},{expert:"Expert 1",principle:"RISK",stance:"supports",source:"unverified"}];
 assert.equal(countDocumentedSupport("RISK",cohort,votes).supporters,0);
});
test("17 distinct sourced experts meet the mechanical threshold",()=>{
 const votes=cohort.slice(0,17).map(expert=>({expert,principle:"RISK",stance:"supports",source:"https://example.org"}));
 const result=countDocumentedSupport("RISK",cohort,votes);
 assert.equal(result.verified85Percent,true);
 assert.match(result.warning,/human-reviewed/);
});
