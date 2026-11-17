# Read-only data activation diagnostic

Draft on main b722f078eb2d4065218b20d30e9521f735ecfbd6. No deployment or activation is part of this draft.

## Why an endpoint is needed

The existing Vercel project has no reusable sandbox sessions. The workspace has no Alpaca credentials. Existing production `/api/historical-bars` verified 80 adjusted IEX bars per NVDA/AMD/PLTR through November 16, but cannot expose the collector's raw 200-session calculation window. Neon owner-connector permission checks cannot establish the role used by the application's DATABASE_URL. No production credentials were exported to work around those limitations.

The two reviewed additive migrations were successfully applied to production on November 17 under separate user authorization. The exact table and daily claims/completions exist in public and were empty after migration; all three append-only triggers are enabled; all four function bodies match the reviewed SQL. These facts do not replace this runtime diagnostic.

## Proposed operator call after separately authorized release

`POST /api/operations/data-readiness` uses the existing CRON_SECRET bearer authorization. Send no query parameters or request body. There is no GET handler, cron entry, caller-selected symbol/date/feed, arbitrary SQL, new credential or additional database privilege. The branch is explicitly deployment-disabled. Do not invoke the daily collection endpoint to obtain these results.

The diagnostic reports current_user/current_database through the application's ordinary connection and runs existing schema/trigger/permission checks. Every statement is inside a Neon readOnly transaction; the identity query confirms transaction_read_only=on. This verifies permissions without writing test evidence, calling nextval, changing grants, creating a claim or modifying history. Results do not establish least privilege or guarantee an eventual write will succeed; owners retain their existing privileges.

It fetches the same bounded raw IEX histories as the prepared collector: NVDA/AMD/PLTR only, three requests, concurrency two, no retries/pagination, 12-second provider timeouts, 1000-bar response bound, last 200-session calculations. The collector's existing chronology/calendar/gap validation and factor calculation are reused. No claim, completion, evidence, audit receipt or scientific record is persisted. No raw bars, SQL errors, connection URL, provider response body or credential is returned. An input hash is unnecessary because this is a transient diagnostic, not persisted evidence.

The overall clock budget is 55 seconds with a 60-second route limit; database HTTP requests share the abort deadline. No new provider batch starts after expiry, clock regression or completed-session change. Each authenticated invocation can issue up to three requests; there is no new cross-instance global rate-limit store. Operators should make one approved diagnostic call and inspect its result rather than repeatedly polling.

`ready_for_activation_review` requires both storage preflights and 24 computable factors from at least 200 valid raw bars for every symbol. Missing data, undefined indicators (including zero-variance inputs), schema/permission failure or provider failure remains blocked. Errors are sanitized; a blocked response may require targeted follow-up. This status neither enables collection nor certifies scientific validity. Existing exactSlippageWrites=false and dailyInvocation=null remain untouched.

## Remaining release steps

Review the draft and exact-head tests, separately authorize code deployment, then invoke the authenticated diagnostic once. Inspect the real runtime role, both storage readiness booleans and each symbol's complete raw-window result. Resolve failures before separately approving writer activation or a bounded daily invocation. No release, collector activation, schedule change or scientific/trading permission follows automatically from this endpoint.
