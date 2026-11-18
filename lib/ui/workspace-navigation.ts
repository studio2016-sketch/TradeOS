/** Only public UI labels are placed in the URL, never symbols or account data. */
export const workspaceSections = {
  Today: "today", Discover: "discover", Analyze: "analyze", Trade: "trade",
  Learn: "learn", Replay: "replay", Journal: "journal", News: "news",
  "Edge Lab": "edge-lab", Alignment: "alignment",
} as const;
export type WorkspaceSection = keyof typeof workspaceSections;
export function sectionFromHash(hash: string): WorkspaceSection | null {
  if (!hash) return "Today";
  for (const [section, slug] of Object.entries(workspaceSections)) {
    if (hash === `#view=${slug}`) return section as WorkspaceSection;
  }
  // Ordinary document anchors (including the skip link) do not change views.
  return null;
}
export type NavigationBrowser = {
  location: { hash: string; pathname: string; search: string };
  history: { state: unknown; pushState: (state: unknown, unused: string, url: string) => void };
  addEventListener: (type: "popstate" | "hashchange", listener: () => void) => void;
  removeEventListener: (type: "popstate" | "hashchange", listener: () => void) => void;
};
export function connectWorkspaceNavigation(browser: NavigationBrowser, onChange: (section: WorkspaceSection) => void) {
  let active: WorkspaceSection = "Today";
  const update = (next: WorkspaceSection) => {
    if (next !== active) { active = next; onChange(next); }
  };
  const sync = () => {
    const section = sectionFromHash(browser.location.hash);
    if (section) update(section);
  };
  sync();
  browser.addEventListener("popstate", sync);
  browser.addEventListener("hashchange", sync);
  return {
    navigate(value: string) {
      if (!Object.prototype.hasOwnProperty.call(workspaceSections, value)) return;
      const next = value as WorkspaceSection;
      if (next === active) return;
      const url = `${browser.location.pathname}${browser.location.search}#view=${workspaceSections[next]}`;
      // Preserve Next's history metadata. A denied history write must not break tabs.
      try { browser.history.pushState(browser.history.state, "", url); } catch { /* in-memory navigation still works */ }
      update(next);
    },
    dispose() {
      browser.removeEventListener("popstate", sync);
      browser.removeEventListener("hashchange", sync);
    },
  };
}

/** Keep the section bookmark intact while providing the native skip-link focus behavior. */
export function skipToWorkspace(event: {preventDefault(): void}, target: {focus(): void; scrollIntoView(options: {block: "start"}): void} | null) {
  if (!target) return;
  event.preventDefault();
  target.focus();
  target.scrollIntoView({block: "start"});
}
