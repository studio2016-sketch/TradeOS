# Daily pilot preparation — inactive proposal

No activation is included. `dailyInvocation` remains null; `exactSlippageWrites` remains false. No new schedule, owner collection route, migration, or production invocation is authorized by this draft.

## What the successful diagnostic proves

Production commit `178d4f0bc918260a26742ebd6d3293c0df5d09a0` defines exactly NVDA, AMD and PLTR and 24 daily factor keys. The diagnostic awaits two batches (two symbols, then one), pushes every result, and returns `ready_for_activation_review` only when both storage checks and every history result are ready. A thrown error cannot produce that success. Thus the reported success establishes all three symbols passed the implemented checks at that run: at least 200 bars and 24 generated factors each. No exact AMD/PLTR bar counts or timestamps can be recovered from that status. NVDA's visible 550 count must not be copied to other symbols.

Storage readiness is catalog/privilege/trigger inspection under the actual runtime role in read-only transactions, not an actual insert/rollback test. The checks establish the implemented gate, not independent proof of every trigger body or future database state. History readiness reuses the calculation and calendar validation; it does not independently certify the feed, predictive skill, future availability or execution readiness. The diagnostic writes no evidence or receipt and cannot recover the lost browser result.

## Proposed activation, requiring separate approval

1. Agree on a secure invocation mechanism first. The existing POST `/api/operations/daily-factor-collection` accepts the existing operator bearer credential only. Its sensitive production credential was not available to the agent. A signed-in owner diagnostic is not permission to collect. Do not expose, rotate, recover or bypass the credential. If an existing authorized runtime cannot invoke it, separately design/review a verified-owner collection endpoint before activation; this draft adds none.
2. Pin one unique approval ID, one completed exchange session and a short opening/expiry in `DATA_ACTIVATION_POLICY.dailyInvocation`, through a separately reviewed release. Determine the session at release time; do not reuse a stale session or permit historical replay. Keep exact slippage writes false. A 15-minute approval requires starting with at least two minutes remaining under the existing collector budget; allow additional operational margin.
3. Recheck exact-head tests/CI and current schema/permissions. Verify the production session claim is absent before authorizing one operator invocation. No retry or schedule. Request body has exactly `approvalId` and `session`; it cannot choose symbols, feed or factors.
4. The fixed scope is NVDA/AMD/PLTR, raw Alpaca IEX, three history requests, concurrency two, no retries or pagination, up to 72 factor candidates. Availability is the actual extraction completion time; do not backdate it to session close. The scientific evidence and completion insert are atomic; the separately committed session claim remains after failure.
5. Independently inspect the receipt, durable claim, completion and rows after the approved run. Report candidates, newly saved rows, per-symbol failures, session, input hashes and actual receipt/availability clocks. Review existing identical rows where saved is below candidates. Verify no historical edits and no scientific promotion or trading authorization.

## Failure semantics and release limitations

The existing collector deliberately permits partial descriptive completion: one failed symbol can leave 48 valid candidates from the others, and an all-failed collection can complete with zero. `daily_invocation_completed` is not a complete-coverage guarantee. If approval requires all 72 or nothing, implement and review that additional requirement before activation; do not represent the current code as all-or-nothing across symbol availability. Atomic rollback protects conflicting value/provenance inserts, not feed completeness.

Claims are permanent for a session. Repeated or concurrent invocations cannot reclaim it; a timeout, provider failure or crash can consume the pilot opportunity. Inspect before any decision; never delete a claim to retry. An uncertain response is not a failed commit. The existing route has a 120-second function budget and collector plan; its body parsing/preflight do not yet share a fully bounded response-margin deadline, so review that operational limitation before activation. No claims of end-to-end production write verification are made here.

## Validation

Regression tests prove each symbol independently vetoes diagnostic success, the final PLTR batch is awaited, the bounded approval composes with the fixed 72-candidate collector and a repeated session does not fetch again, and partial completion remains explicit. Existing PostgreSQL conflict/rollback and storage tests remain required; these new orchestration fixtures do not substitute for real database concurrency testing.
