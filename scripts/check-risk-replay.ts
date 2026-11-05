import {readFileSync} from "node:fs";
import {crossCheckCapturedRiskRow} from "../lib/research/risk-reference-check";

// Deliberately offline: reads one local JSON export, reports to stdout, never writes.
try{
 if(process.argv.length!==3)throw Error("Usage: node --import tsx scripts/check-risk-replay.ts <rows.json>");
 const rows:unknown=JSON.parse(readFileSync(process.argv[2],"utf8"));
 if(!Array.isArray(rows))throw Error("Expected a JSON array of exported factor-evidence rows");
 const results=rows.map(crossCheckCapturedRiskRow);
 console.log(JSON.stringify({status:"RESEARCH_ONLY",scope:"ARITHMETIC_CROSS_CHECK_ONLY",rows:results.length,results,certified:false},null,2));
 if(!results.length||results.some(x=>x.status!=="REFERENCE_AGREES"))process.exitCode=1;
}catch(error){console.error(error instanceof Error?error.message:"Invalid replay export");process.exitCode=1;}
