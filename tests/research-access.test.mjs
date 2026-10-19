import test from "node:test";
import assert from "node:assert/strict";
import {mayAccessResearch} from "../lib/auth/research-access.ts";

const base={userId:"sample-user",emailVerified:true,accountDisabled:false};
test("unknown identity denied all research access",()=>{
 for(const action of ["read","upload","investigate","invite"])assert.equal(mayAccessResearch(null,action),false);
});
test("unapproved accounts cannot access the research vault",()=>{
 for(const action of ["read","upload","investigate","invite"])assert.equal(mayAccessResearch({...base,role:"unapproved"},action),false);
});
test("unverified email and disabled user are always denied",()=>{
 assert.equal(mayAccessResearch({...base,emailVerified:false,role:"owner"},"upload"),false);
 assert.equal(mayAccessResearch({...base,accountDisabled:true,role:"owner"},"read"),false);
});
test("viewer cannot upload, investigate, or invite",()=>{
 for(const action of ["upload","investigate","invite"])assert.equal(mayAccessResearch({...base,role:"viewer"},action),false);
 assert.equal(mayAccessResearch({...base,role:"viewer"},"read"),true);
});
test("researcher cannot invite; owner may administer",()=>{
 assert.equal(mayAccessResearch({...base,role:"researcher"},"invite"),false);
 assert.equal(mayAccessResearch({...base,role:"researcher"},"upload"),true);
 assert.equal(mayAccessResearch({...base,role:"owner"},"invite"),true);
});
