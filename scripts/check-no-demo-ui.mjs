import {readFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
const files=[];
function scan(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())scan(path);else if(/\.(tsx|ts)$/.test(entry.name))files.push(path)}}
scan("app");
const failures=[];
for(const path of files){
 const text=readFileSync(path,"utf8");
 if(path==="app/page.tsx"){
  for(const pattern of [/const\s+(?:sampleOpportunities|calibration|anomalies)\s*=\s*\[/,/className="volcurve"/,/className="chartline"/,/<button>/,/const\s+crossAsset=\s*\[\[/]){
   if(pattern.test(text))failures.push(path+": prohibited static market fixture / noninteractive button: "+pattern);
  }
 }
 if(/mode:\s*["']fallback_demo["']/.test(text))failures.push(path+": demo market mode must never be used by business endpoints");
}
if(failures.length){console.error(failures.join("\n"));process.exit(1)}
console.log("No prohibited fixture patterns in application code.");
