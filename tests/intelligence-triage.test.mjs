import test from "node:test";import assert from "node:assert/strict";import {scoreLead} from "../lib/research/intelligence-triage.ts";
const lead={id:"sample",headline:"A verified hypothetical announcement",publishedAt:"2026-10-19T10:00:00Z",observedAt:"2026-10-19T10:01:00Z",sourceFamily:"official",otherSourceFamilies:["independent_news"],symbols:["SPY"],mechanism:"Testable changes in discount rates",novelty:90,materiality:90,quality:90,relevance:90,urgency:90,contradictions:0};
test("eligible high-value lead is investigation only",()=>{const x=scoreLead(lead,"2026-10-19T10:02:00Z");assert.equal(x.action,"INVESTIGATE");assert.equal(x.tradeAuthorized,false)});
test("uncorroborated lead quarantined",()=>assert.equal(scoreLead({...lead,otherSourceFamilies:[]},"2026-10-19T10:02:00Z").action,"QUARANTINE"));
test("future reported lead quarantined",()=>assert.equal(scoreLead({...lead,observedAt:"2026-10-21T10:00:00Z"},"2026-10-19T10:02:00Z").action,"QUARANTINE"));
test("contradictions reduce priority",()=>assert.ok(scoreLead({...lead,contradictions:3},"2026-10-19T10:02:00Z").score<scoreLead(lead,"2026-10-19T10:02:00Z").score));
