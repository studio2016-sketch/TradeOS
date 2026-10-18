import test from "node:test";import assert from "node:assert/strict";
import {validateChronologicalForecasts} from "../lib/research/chronologicalValidation";
const samples=(prob:(i:number)=>number,n=200)=>Array.from({length:n},(_,i)=>({time:new Date(Date.UTC(2026,0,1)+i*86400000).toISOString(),probability:prob(i),outcome:(i%5===0?1:0) as 0|1}));
test("Research validation withholds claims when evidence is insufficient",()=>{const v=validateChronologicalForecasts(samples(()=>.5,25));assert.equal(v.status,"INSUFFICIENT_EVIDENCE");assert.equal(v.evidenceOfImprovement,false)});
test("Skill analysis uses chronological frozen training baseline",()=>{const v=validateChronologicalForecasts(samples(()=>.2));assert.equal(v.status,"RESEARCH_ONLY");assert.ok(Math.abs(v.baselineBrier!-.16)<.001);assert.ok(Math.abs(v.modelBrier!-.16)<.001);assert.equal(v.evidenceOfImprovement,false)});
test("Invalid data is excluded rather than treated as outcome evidence",()=>{const a=samples(()=>.2,200);a.push({time:"invalid",probability:100,outcome:1});assert.equal(validateChronologicalForecasts(a).sampleCount,200)});
