import test from "node:test";
import assert from "node:assert/strict";
import {validateArtifactInput,MAX_RESEARCH_BYTES} from "../lib/storage/file-validation.ts";
import {fingerprintResearchFile,researchObjectKey} from "../lib/storage/fingerprint.ts";

test("accepts a research CSV within the upload limit",()=>{
 assert.equal(validateArtifactInput({size:1024,contentType:"text/csv",filename:"bars.csv"}).allowed,true);
});
test("rejects empty and oversize files",()=>{
 assert.equal(validateArtifactInput({size:0,contentType:"text/csv",filename:"a.csv"}).allowed,false);
 assert.equal(validateArtifactInput({size:MAX_RESEARCH_BYTES+1,contentType:"text/csv",filename:"a.csv"}).allowed,false);
});
test("rejects unsupported content types",()=>{
 assert.equal(validateArtifactInput({size:32,contentType:"application/x-msdownload",filename:"program.exe"}).allowed,false);
});
test("rejects path-like filenames",()=>{
 assert.equal(validateArtifactInput({size:32,contentType:"text/csv",filename:"../secrets.csv"}).allowed,false);
});
test("SHA-256 digest is stable and duplicate content maps to one object key",()=>{
 const first=fingerprintResearchFile(new TextEncoder().encode("TradeOS research"));
 const second=fingerprintResearchFile(new TextEncoder().encode("TradeOS research"));
 assert.deepEqual(first,second);
 assert.match(first.sha256,/^[a-f0-9]{64}$/);
 assert.equal(researchObjectKey("tradeos",first.sha256),researchObjectKey("tradeos",second.sha256));
});
test("rejects traversal in an owner identifier",()=>{
 assert.throws(()=>researchObjectKey("../user","a".repeat(64)));
});
