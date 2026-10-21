import test from "node:test";import assert from "node:assert/strict";
import {evaluateFactorAssociation} from "../lib/research/factorIntelligence.ts";
const samples=Array.from({length:100},(_,i)=>({label:"Recorded factor",value:i%2,outcome:(i%4===0?1:0) as 0|1,time:new Date(Date.UTC(2026,0,1)+i*86400000).toISOString()}));
test("Factor lab publishes only descriptive association, never predictive certification",()=>{
 const [r]=evaluateFactorAssociation(samples);
 assert.equal(r.recorded,100);assert.equal(r.training,70);assert.equal(r.holdout,30);assert.equal(r.validated,false);assert.equal(r.eligibleForModelPromotion,false);
});
test("Factor lab drops fabricated future/invalid timestamps",()=>{const x=evaluateFactorAssociation([...samples,{...samples[0],time:"invalid"}]);assert.equal(x[0].recorded,100)});
