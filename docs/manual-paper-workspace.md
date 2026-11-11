# Manual paper risk workspace

Local preparation against main `2544c8e67be84d6e1ace4b61a607e840de9b2878`. Nothing is published or activated by this change.

## Purpose and existing behavior

The Trade tab already contained a dollar-risk sizing calculator. This proposal replaces its entry point with a link to `/paper-workspace`, so there is one adjustable calculator rather than two inconsistent sizing implementations. The adjacent evidence/risk panel remains unchanged. The assistant's canned risk answer points to the same workspace rather than using a second calculation.

`app/api/research-paper/route.ts` remains the existing illustrative one-share/$10,000 read-only bridge. Its quote verification, research vetoes, simulator, portfolio risk gates, and certification restrictions are untouched. The new planner does not call or bypass it. No existing research protocol or authority is changed.

The separate page is deliberate: loading Home initiates provider-backed dashboard refreshes. The manual planner has no fetch, API, broker, database, timer, storage, or account integration. It works from manual hypothetical values only. Navigation back to the existing Home page retains Home's existing behavior.

## Calculation contract

- Blank defaults: hypothetical USD equity, chosen risk percentage, entry, stop and target.
- Long-only whole shares, stop below entry and target above entry. Equity is assumed to be entirely available cash for one hypothetical position.
- Budget = equity × risk percentage ÷ 100, rounded down to cents.
- Shares = floor of the smallest of budget / (entry − stop), equity / entry and 100,000.
- Notional = shares × entry. Planned stop loss = shares × (entry − stop). Hypothetical target gain = shares × (target − entry).
- Decimal inputs are parsed to fixed-scale integers. BigInt arithmetic prevents floating-point rounding from oversizing at decimal boundaries. Money outputs retain up to four decimal places, so a positive sub-cent loss is not displayed as zero. Reward/risk is explicitly approximate (six significant digits).
- Equity permits two decimals up to $1 billion; prices permit four decimals up to $1 million; risk permits four decimals above 0% up to 100%. These are defensive calculator bounds, not suitable-risk recommendations.
- Reject nonfinite strings, exponents, grouping separators, excess precision, non-string values, invalid geometry and out-of-range inputs. Incomplete or invalid assumptions return no size. A budget below one cent or insufficient capital can return zero shares, which cannot be saved as a draft.
- Every result says manual hypothetical source, paper only, no live authorization, no fill simulation and no certification.

This is not a worst-case loss bound. Gaps, fees, slippage, spreads, taxes, liquidity, halts, partial fills, unavailable exits and execution failure are not modeled. Existing holdings, portfolio concentration, daily realized losses and independent evidence gates are not evaluated. No market readiness or predictive quality follows from the output.

## Session journal

Up to 20 independent arithmetic snapshots live in React memory only. Nothing is uploaded or written to localStorage, sessionStorage, IndexedDB, cookies or a server. Snapshots copy canonical inputs and results; editing the working plan does not change saved drafts. Repeated saves of numerically identical inputs are deduplicated. A full journal does not evict older drafts. Loading, removing and clearing are local operations. Resetting inputs preserves saved drafts. Reloading or leaving the page can lose the journal.

These are comparisons, not attributed trades, fills, outcomes or personal performance records. Draft sizes are not summed into a portfolio. There is no symbol/quote attachment or claim that an entry or stop was observed or executed.

## Verification

Run the existing repository commands with CI-only placeholder auth configuration:

```sh
npm test
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 NEON_AUTH_BASE_URL=https://ci.invalid \
NEON_AUTH_COOKIE_SECRET=ci-build-only-cookie-secret-0123456789abcdef npm run build
```

The new tests cover exact decimal sizing, percentage and cash caps, zero shares, bounds, malformed inputs, stop/target geometry, non-execution flags, journal copying/deduplication/capacity, a separate 400-scenario integer reference sweep, rendered blank defaults/labels/disclaimers, and absence of provider/storage paths in the new page. Existing simulator, research bridge and scientific veto tests remain part of the full suite.

An optional browser script is supplied without adding a package dependency:

```sh
# Requires Playwright and a browser already installed locally.
# Start the production app separately on 127.0.0.1:3012 with CI placeholders.
node scripts/check-manual-paper-ui.mjs
```

Optional variables: `PAPER_WORKSPACE_URL` (localhost only), `PLAYWRIGHT_MODULE` (installed Playwright module), `CHROMIUM_PATH`, and `PAPER_QA_OUTPUT` (default `/tmp/tradeos-paper-ui`). The script blocks all external and `/api/` page requests and checks calculation, duplicate prevention, snapshot isolation, mobile overflow, reset/load/remove/clear, invalid/zero-share inputs, capacity, reload, and Back/Forward. It does not submit to production or call providers.

Browser verification is **not completed** in this environment. Starting installed Chromium fails with an OS `socket() failed: Operation not permitted` restriction, including the approved elevated attempt; the supported cloud browser cannot reach the local app (`ERR_CONNECTION_REFUSED`). No screenshots, desktop/mobile flow pass or runtime network observation are claimed. The optional browser script must run in a browser-capable local environment before release. Server-rendered component checks and production compilation do not replace interactive browser testing.

## Order and release dependencies

Preserve the requested sequence: data corrections, trustworthy foundation, adjustable workspace, quality improvements, then reliability. Preparing this manual-only page in parallel does not mean the foundation is complete or authorize changing that order for merge/release. Draft PRs #81–84 cover separate resolver, history, news parsing and evidence intake work; this change neither duplicates nor activates them. Future connections to real observations, account data, persistent journals or execution need separate design, review, authorization and evidence. No new spending, provider plan, migration or production write is included.

Independent code review passed. Interactive browser verification and owner release authorization remain required before deployment. This proposal is not execution-quality or scientific certification.
