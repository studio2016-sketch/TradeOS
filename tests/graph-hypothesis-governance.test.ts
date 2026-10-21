import test from "node:test";
import assert from "node:assert/strict";
import {graphHypotheses} from "../lib/research/factorDiscovery.ts";

const graph=(sources:string[])=>({
 generatedAt:"2026-10-19T15:00:00.000Z",symbols:["SPY"],nodes:[],
 edges:[{id:"macro",from:"economic:regime",to:"market:SPY",relation:"multi_agency_macro_hypothesis",evidenceClass:"authoritative" as const,sources,independentSourceCount:new Set(sources).size,strength:null,direction:"unknown" as const,predictiveAuthority:false as const,note:"test"}],
 stats:{nodes:0,edges:1,multiSourceEdges:sources.length>=2?1:0,authoritativeEdges:1,sourceFamilies:[...new Set(sources)]},
 sourceHealth:[],
 policy:{graphImpliesPrediction:false as const,minimumIndependentSourcesForCertification:2,sourceCountMeansIndependentOriginFamilies:true as const}
});

test("one origin family remains insufficient",()=>{
 const result=graphHypotheses(graph(["BLS"]));
 assert.equal(result.hypotheses[0].state,"insufficient");
 assert.equal(result.hypotheses[0].predictiveAuthority,false);
});

test("multiple origin families create a candidate, never predictive authority",()=>{
 const result=graphHypotheses(graph(["BLS","BEA","U.S. Treasury"]));
 assert.equal(result.hypotheses[0].state,"candidate");
 assert.equal(result.hypotheses[0].sourceCount,3);
 assert.equal(result.hypotheses[0].predictiveAuthority,false);
 assert.equal(result.policy.certificationRequired,true);
});
