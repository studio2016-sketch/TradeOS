# Restorable workspace sections

The ten existing workspace sections now use exact allowlisted URL fragments, such as `#view=learn` and `#view=edge-lab`. Reloading a bookmarked section restores it after hydration; browser Back and Forward follow section changes. Repeated selection does not add duplicate history entries. This does not preserve learning answers, trading inputs, selected symbols or evidence, and does not add persistence or network calls.

Server and initial client render both start on Today. An effect reads the URL only after mount to avoid hydration mismatch. Invalid hashes and ordinary anchors do not change the section. The keyboard skip link focuses and scrolls the workspace without replacing its section bookmark. Navigating preserves the existing pathname, query and Next history state; only a fixed section slug is added. A failed history write falls back to ordinary in-memory navigation. Mobile More and assistant overlays close when the section changes, including through browser history. Listeners are removed on unmount.

Verification: exact hash allowlist, deep links, duplicate clicks, invalid section names, Back/Forward, duplicate browser events, skip anchors, listener cleanup/remount, denied history writes, deterministic server rendering, and mobile overlay wiring are covered by focused tests. Actual browser/mobile interaction QA remains separate from these checks. No authentication, research evidence, API, broker or collector behavior changes.

Next independent gap: durable owner-only display of completed daily pilot receipts, so a verified run remains visible after reload. Do not substitute a client success flag for a durable server receipt.
