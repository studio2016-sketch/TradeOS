import test from "node:test";
import assert from "node:assert/strict";
import {phase3BlockerFor} from "../lib/research/phase3-blockers.ts";

test("Phase 3 blocker classifier preserves hard source/context boundaries",()=>{
 assert.equal(phase3BlockerFor("var_95")?.category,"portfolio_context_required");
 assert.equal(phase3BlockerFor("pmi_manufacturing")?.category,"source_permission_required");
 assert.equal(phase3BlockerFor("pe_forward")?.category,"licensed_analyst_consensus_required");
 assert.equal(phase3BlockerFor("earnings_call_sentiment")?.category,"transcript_source_required");
 assert.equal(phase3BlockerFor("supplier_event")?.category,"relationship_graph_required");
 assert.equal(phase3BlockerFor("beta"),null);
 assert.equal(phase3BlockerFor("rolling_correlation"),null);
});
test("event-driven factors are not fabricated as zero when no event exists",()=>{
 for(const key of ["earnings_date","eps_surprise","revenue_surprise","guidance_change","buyback_announcement","regulatory_change","tariff_exposure"]){
  assert.equal(phase3BlockerFor(key)?.category,"explicit_event_required");
 }
});
