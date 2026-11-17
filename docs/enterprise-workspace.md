# Enterprise research workstation proposal

## Scope

This is a private UI-quality upgrade, not a subscription offer. No billing, sharing, broker, authentication, evidence, collection, diagnostic or certification behavior is changed. Existing main was `178d4f0` (PR #106) when work began. Existing draft #95 is not integrated here; reconcile its `app/page.tsx` edits before combining releases.

The home page now opens with a decision brief, observed factor coverage, an explicitly locked execution label, timestamped focus-list observations, unresolved factor preview, research navigation, source-status report and calendar. Empty data stays unavailable. Counts are not represented as accuracy, success or independent certification. Refresh completion is distinguished from source freshness.

All ten original sections and every previous home panel remain accessible. The former full home overview is behind a native details disclosure; it is not deleted. Existing fetch behavior, derived scores, calculator and paper gates are unchanged. Static assistant guidance now has an explicit educational/not-live-assessment label.

The visual system uses restrained charcoal, sage, warm neutral typography, reduced visual noise, consistent surfaces and a responsive workflow. Navigation includes a skip link, current-page labels, expanded-state mobile menu and reduced-motion treatment. Mobile uses safe-area-aware bottom navigation and a collapsed assistant launcher.

## Verification

- Five new render/source regression tests cover empty states, safe labels, observed fixtures, malformed dates/nonfinite values, unique selected symbols, links and retention of existing sections.
- Run `npm test`, `npx tsc --noEmit`, and the existing webpack production build with CI-only authentication placeholders.
- No diagnostic/backend files are modified.

## Outstanding release gates

Actual browser visual and interaction verification remains required at desktop and 390px/320px phone widths, including keyboard navigation, stock picker, each section, expanded legacy detail, assistant, mobile More, and interrupted/failing requests. Local Chromium launch failed with `socket() failed: Operation not permitted`, including the authorized elevated attempt. Rendered component tests are not browser QA and screenshots are not claimed.

A local isolated component bundle was prepared for optional browser testing. It is test-only and does not change authentication or production. Any fixtures must remain clearly test-only and all external/provider requests must be blocked when exercising them.

The legacy page still has known fetch/reliability and data-validation issues. The new layout does not repair or certify them. Source health labels are reports from existing endpoints, not a new independent audit. The new overview's selection uses the existing symbol workflow.

Keep the PR in draft. Do not merge or deploy without a separate release decision after final-head checks and browser QA.
