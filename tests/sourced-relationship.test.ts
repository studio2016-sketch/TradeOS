import test from "node:test";import assert from "node:assert/strict";
import {validateSourcedRelationship} from "../lib/research/sourcedRelationship";
const item={subjectKind:"company",subjectId:"Example Company",relation:"SUPPLIES",objectKind:"company",objectId:"Example Customer",sourceUrl:"https://www.sec.gov/Archives/test.htm",sourceName:"SEC filing",publishedAt:"2026-10-01T13:00:00Z",observedAt:"2026-10-01T13:10:00Z",evidenceExcerpt:"Example hypothetical evidence solely for an automated test."};
test("Dated source relationship can be stored but is never declared independently verified",()=>{
 const x=validateSourcedRelationship(item,Date.parse("2026-10-18T12:00:00Z"));
 assert.equal(x.valid,true);if(x.valid){assert.equal(x.verificationStatus,"SOURCE_RECORDED");assert.equal(x.checksum.length,64)}
});
test("Reject future source publication, fabricated source URL and chronology reversal",()=>{
 assert.equal(validateSourcedRelationship({...item,publishedAt:"2026-10-19T13:00:00Z"},Date.parse("2026-10-18T12:00:00Z")).valid,false);
 assert.equal(validateSourcedRelationship({...item,sourceUrl:"http://example.com"},Date.parse("2026-10-18T12:00:00Z")).valid,false);
 assert.equal(validateSourcedRelationship({...item,observedAt:"2026-09-30T13:00:00Z"},Date.parse("2026-10-18T12:00:00Z")).valid,false);
});
