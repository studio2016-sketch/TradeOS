import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {renderToString} from "react-dom/server";
import {connectWorkspaceNavigation, sectionFromHash, skipToWorkspace, workspaceSections, type NavigationBrowser} from "../lib/ui/workspace-navigation";
import useWorkspaceNavigation from "../app/components/useWorkspaceNavigation";
import {readFileSync} from "node:fs";
function fixture(hash = "") {
  const listeners = new Map<string, Set<() => void>>();
  const entries = [hash]; let index = 0;
  const changes: string[] = []; const writes: string[] = [];
  const state = {__NA: true, tree: ["existing-next-state"]};
  const browser: NavigationBrowser = {
    location: {hash, pathname: "/", search: "?display=compact"},
    history: {state, pushState(s, _unused, url) {
      assert.equal(s, state); writes.push(url);
      browser.location.hash = new URL(url, "https://example.invalid").hash;
      entries.splice(index + 1); entries.push(browser.location.hash); index++;
    }},
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type,new Set()); listeners.get(type)!.add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
  const emit = (type: string) => listeners.get(type)?.forEach(fn => fn());
  const go = (delta: number) => { index += delta; browser.location.hash = entries[index]; emit("popstate"); emit("hashchange"); };
  const connection = connectWorkspaceNavigation(browser, value => changes.push(value));
  return {browser, connection, changes, writes, listeners, emit, go};
}
test("all ten sections have exact allowlisted hashes; arbitrary data and skip anchors are ignored", () => {
  for (const [section, slug] of Object.entries(workspaceSections)) assert.equal(sectionFromHash(`#view=${slug}`),section);
  assert.equal(sectionFromHash(""),"Today");
  for (const hash of ["#workspace-content", "#view=learn&account=secret", "#view=__proto__", "#view=%6cearn", "#view=unknown"]) assert.equal(sectionFromHash(hash),null);
});
test("deep links restore section, repeated clicks do not add history and invalid sections never enter URL", () => {
  const f=fixture("#view=learn"); assert.deepEqual(f.changes,["Learn"]);
  f.connection.navigate("Learn"); f.connection.navigate("__proto__"); f.connection.navigate("Account-secret");
  assert.deepEqual(f.writes,[]);
  f.connection.navigate("Edge Lab"); assert.deepEqual(f.writes,["/?display=compact#view=edge-lab"]);
  f.connection.navigate("Edge Lab"); assert.equal(f.writes.length,1);
});
test("back and forward restore views once even when both browser events fire", () => {
  const f=fixture();f.connection.navigate("Learn");f.connection.navigate("Analyze");
  f.go(-1);f.go(-1);f.go(1);f.go(1);
  assert.deepEqual(f.changes,["Learn","Analyze","Learn","Today","Learn","Analyze"]);
  assert.equal(f.writes.length,2);
});
test("skip link preserves current section, disposal removes both listeners, remount restores current URL", () => {
  const f=fixture("#view=journal");f.browser.location.hash="#workspace-content";f.emit("hashchange");
  assert.deepEqual(f.changes,["Journal"]);f.connection.dispose();
  assert.ok([...f.listeners.values()].every(set=>set.size===0));
  f.browser.location.hash="#view=replay";f.emit("popstate");assert.deepEqual(f.changes,["Journal"]);
  const restored:string[]=[];const second=connectWorkspaceNavigation(f.browser,x=>restored.push(x));
  assert.deepEqual(restored,["Replay"]);second.dispose();
});
test("unavailable history API still permits in-memory tab changes", () => {
  const f=fixture();f.browser.history.pushState=()=>{throw new Error("restricted")};f.connection.navigate("Learn");
  assert.deepEqual(f.changes,["Learn"]);assert.equal(f.browser.location.hash,"");
});
test("server and hydration first render are deterministic without window access", () => {
  function Probe(){const[active]=useWorkspaceNavigation();return <span>{active}</span>}
  assert.equal(renderToString(<Probe/>),"<span>Today</span>");
});
test("mobile overlays close when restored section changes; the page uses one shared navigation hook", () => {
  const source=readFileSync(new URL("../app/private-page.tsx",import.meta.url),"utf8");
  assert.match(source,/const\[active,setActive\]=useWorkspaceNavigation\(\)/);
  assert.match(source,/useEffect\(\(\)=>\{setMobileMore\(false\);setAskOpen\(false\)\},\[active\]\)/);
});

test("keyboard skip keeps bookmark and Back/Forward section restoration intact", () => {
  const f=fixture("#view=journal");let prevented=false,focused=false,scrolled=false;
  skipToWorkspace({preventDefault(){prevented=true}}, {focus(){focused=true},scrollIntoView(options){assert.deepEqual(options,{block:"start"});scrolled=true}});
  assert.ok(prevented&&focused&&scrolled);assert.equal(f.browser.location.hash,"#view=journal");
  f.connection.navigate("Analyze");f.go(-1);f.go(1);
  assert.deepEqual(f.changes,["Journal","Analyze","Journal","Analyze"]);
  let missingPrevented=false;skipToWorkspace({preventDefault(){missingPrevented=true}},null);assert.equal(missingPrevented,false);
});
