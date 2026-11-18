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
 assert.equal(result.mechanicalThresholdMet,true);
 assert.equal(result.verified85Percent,false);
 assert.equal(result.notEstablished,true);
 assert.equal(result.status,"UNVERIFIED");
 assert.match(result.warning,/reviewed passages/);
});

test("opposing evidence vetoes all 17 apparent supporters regardless of order or source validity",()=>{
 const votes=cohort.slice(0,17).flatMap(expert=>[
  {expert,principle:"RISK",stance:"supports",source:"https://example.org"},
  {expert,principle:"RISK",stance:"contradicts",source:"unresolved-source"},
 ]);
 const result=countDocumentedSupport("RISK",cohort,votes);
 assert.equal(result.supporters,0);assert.equal(result.mixedCount,17);assert.equal(result.unknownCount,3);
 assert.equal(result.mechanicalThresholdMet,false);assert.equal(result.verified85Percent,false);
 assert.deepEqual(countDocumentedSupport("RISK",cohort,[...votes].reverse()),result);
});
test("mixed and malformed stances veto support while categories partition the cohort",()=>{
 const vote=(expert,stance,source="https://example.org",principle="RISK")=>({expert,stance,source,principle});
 const result=countDocumentedSupport("RISK",cohort,[
  vote("Expert 0","supports"),vote("Expert 0","mixed"),
  vote("Expert 1","supports"),vote("Expert 1","unexpected"),
  vote("Expert 2","contradicts"),vote("Expert 3","unknown"),
  vote("Expert 4","related_not_individual_attestation"),
  vote("Expert 5","supports"),vote("Expert 5","contradicts","https://example.org","OTHER"),
  vote("Outside cohort","supports"),
 ]);
 assert.equal(result.supporters,1);assert.equal(result.mixedCount,1);assert.equal(result.contradictingCount,1);
 assert.equal(result.unresolvedCount,1);assert.equal(result.unknownCount,16);
 assert.equal(result.verified85Percent,false);
});
test("malformed URLs and duplicate/empty cohort members cannot manufacture consensus",()=>{
 for(const source of ["https://","https://user:pass@example.org","http://example.org","not-url"]){
  assert.equal(countDocumentedSupport("RISK",cohort,cohort.map(expert=>({expert,principle:"RISK",stance:"supports",source}))).supporters,0);
 }
 for(const c of [[...cohort,"Expert 0"],cohort.slice(0,19),[...cohort.slice(0,19)," "],[...cohort.slice(0,19),"Expert 0"]])assert.throws(()=>countDocumentedSupport("RISK",c,[]));
 assert.throws(()=>countDocumentedSupport(" ",cohort,[]));
});
test("all 20 unreviewed source leads remain unverified and actual seed evidence creates no consensus",async()=>{
 const result=countDocumentedSupport("RISK",cohort,cohort.map(expert=>({expert,principle:"RISK",stance:"supports",source:"https://example.org"})));
 assert.equal(result.supporters,20);assert.equal(result.mechanicalThresholdMet,true);assert.equal(result.verified85Percent,false);
 const {expertArchetypes,principles,consensusMethod}=await import("../lib/research/expert-archetypes.ts");
 assert.equal(consensusMethod.status,"UNVERIFIED");
 for(const principle of [...principles.map(p=>p.code),...expertEvidence.map(e=>e.principle)]){
  const actual=countDocumentedSupport(principle,expertArchetypes.map(e=>e.name),expertEvidence);
  assert.equal(actual.verified85Percent,false);assert.equal(actual.mechanicalThresholdMet,false);
 }
});
