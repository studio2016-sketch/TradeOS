import test from "node:test";import assert from "node:assert/strict";
import {graphFromResearch} from "../lib/research/financialGraph.ts";
import {certifyResearch} from "../lib/research/certificationAuthority.ts";
test("Graph only creates evidenced lineage without inventing company suppliers",()=>{
 const graph=graphFromResearch([{symbol:"NVDA",modelVersion:"shadow-trend-v1",source:"Alpaca:iex",forecastTime:"2026-10-18T15:00:00Z",sourceObservedAt:"2026-10-18T14:55:00Z",factorLabels:["75m price trend","Spread"],forecastId:"15"}]);
 assert.equal(graph.nodes.some(n=>n.kind==="instrument"),true);
 assert.equal(graph.edges.length,4);
 assert.equal(graph.metadata.corporateRelationshipEdges,0);
 assert.ok(graph.edges.every(x=>x.evidenceId==="15"));
});
test("Missing source time remains explicitly undated",()=>{
 const result=graphFromResearch([{symbol:"SPY",modelVersion:"v1",source:"source_unknown",forecastTime:"2026-10-18T15:00:00Z",sourceObservedAt:null,factorLabels:[],forecastId:"1"}]);
 assert.equal(result.metadata.undatedEdges,2);
});
test("Research authority fails closed despite favorable numerical scores",()=>{
 const result=certifyResearch({total:300,immutableRecords:300,sourceTimeVerified:300,publicationTimeVerified:300,outOfSamplePaired:250,independentSessionDates:30,predictiveSkillLowerBound:.1,costAdjustedReturnLowerBound:.05,portfolioReconciled:true,executionSlippageValidated:true});
 assert.equal(result.modelPromotionAllowed,false);assert.equal(result.certified,false);
});
test("Missing point-in-time evidence prevents certification",()=>{
 const result=certifyResearch({total:300,immutableRecords:0,sourceTimeVerified:0,publicationTimeVerified:0,outOfSamplePaired:300,independentSessionDates:40,predictiveSkillLowerBound:.5,costAdjustedReturnLowerBound:null,portfolioReconciled:false,executionSlippageValidated:false});
 assert.ok(result.failedChecks.includes("immutable_point_in_time"));assert.equal(result.liveExecutionAllowed,false);
});
