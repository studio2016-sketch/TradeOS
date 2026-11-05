import {readFileSync} from "node:fs";
import {compareIexCapturedSessions} from "../lib/research/iex-session-comparison";
try{
 if(process.argv.length!==3)throw Error("Usage: node --import tsx scripts/check-risk-sessions.ts <rows.json>");
 const rows:unknown=JSON.parse(readFileSync(process.argv[2],"utf8"));
 if(!Array.isArray(rows))throw Error("Expected an array of exported factor-evidence rows");
 const results=rows.map(compareIexCapturedSessions);
 console.log(JSON.stringify({status:"RESEARCH_ONLY",scope:"REGULAR_SCHEDULE_COMPARISON_NOT_FEED_COMPLETENESS",rows:results.length,results,certified:false},null,2));
 if(!results.length||results.some(x=>x.status!=="REGULAR_SCHEDULE_MATCH"))process.exitCode=1;
}catch(error){console.error(error instanceof Error?error.message:"Invalid export");process.exitCode=1;}
