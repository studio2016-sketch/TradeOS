import test from "node:test";
import assert from "node:assert/strict";
import {factorDependencyInventory,factorDependencySummary} from "../lib/research/factor-dependency-inventory.ts";
import {FACTOR_KEYS} from "../lib/research/acceleration-factors.ts";
test("every catalog factor has exactly one explicit dependency diagnostic",()=>{
 const items=factorDependencyInventory();
 assert.equal(items.length,120);
 assert.equal(new Set(items.map(x=>x.key)).size,120);
 assert.deepEqual(items.map(x=>x.key),FACTOR_KEYS);
 assert.equal(items.filter(x=>x.certified).length,0);
 assert.equal(factorDependencySummary().approvedForTrading,false);
});
test("only identifiable implementation paths are declared code candidates",()=>{
 const items=factorDependencyInventory();
 for(const item of items){
  if(item.mappingState==="code_candidate_unverified")assert.ok(item.implementationPath&&item.collectorPath);
  else assert.ok(item.blockers.length>0);
 }
 assert.equal(items.find(x=>x.key==="var_95")?.mappingState,"code_candidate_unverified");
 assert.equal(items.find(x=>x.key==="var_95")?.implementationPath,"lib/research/portfolio-factor-engine.ts");
 assert.equal(items.find(x=>x.key==="cpi_yoy")?.sourceClass,"official_macro_series");
});

test('retired acceleration collection is explicitly unscheduled without claiming other collectors are operational',()=>{
 const items=factorDependencyInventory();
 const daily=items.filter(x=>x.sourceClass==='completed_daily_bars');
 assert.equal(daily.length,24);
 for(const item of items){
  assert.equal(item.blockers.includes('COLLECTOR_NOT_SCHEDULED'),item.collectorPath==='app/api/cron/acceleration/route.ts');
  assert.equal(item.certified,false);
 }
});
