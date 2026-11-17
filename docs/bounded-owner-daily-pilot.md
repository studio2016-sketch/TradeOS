# Inactive bounded owner daily pilot

This draft does not activate collection: `DATA_ACTIVATION_POLICY.dailyInvocation` remains null and `exactSlippageWrites` remains false. No schedules, migrations, credentials, scientific certification or execution permissions change. The branch disables automatic Vercel deployment.

## Owner invocation without an operator secret

`/operations/daily-pilot` offers an explicit account-verification button using the existing read-only account-status endpoint and a separate collection button. It never collects on page load or retries automatically. The collection button remains disabled while the release policy is null. The new POST `/api/operations/owner-daily-pilot` independently requires the exact production URL/origin, same-origin Fetch Metadata, a dedicated custom header, zero payload bytes, a server-validated session, the configured owner ID, and a current verified/unbanned admin database record. It accepts no caller-selected approval, session, symbol, feed or factor. The same existing source-controlled approval and durable session claim govern both owner and bearer routes, preventing cross-route duplicate attempts. The expired diagnostic window is not reused.

No CRON_SECRET is exposed, recovered or rotated. The existing operator route remains available with its original bearer requirement. Neither route can be used until a separately approved release pins one ID, one completed session and an opening/expiry. The existing policy permits at most 24 hours, always restricted to the same latest completed session; an eventual owner approval can use a practical window instead of a 15-minute diagnostic countdown. The request must retain the full 90-second collector budget inside that window. Session changes, finalization periods, expired approvals and incomplete time budgets fail closed.

## Time and cancellation

Both 120-second routes share a 105-second request budget with a 15-second function-response margin. Body reading is limited to 512 actual bytes and two seconds, independent of Content-Length. Owner session verification retains its five-second bound. Database queries use Neon transactions with the shared abort signal; authorization/preflight transactions are explicitly read-only. No new SQL can start after cancellation. Before collection, the entire 90-second collector plan must fit in the remaining request budget; slow auth or preflight cannot reset it. The daily plan now lasts at most 90 seconds, rather than 120; no stored record is rewritten. The provider batch gate reserves each existing 12-second provider timeout plus three seconds before starting a batch, including PLTR's final batch.

Transport cancellation is not proof of rollback or a failed commit. A 503 `daily_invocation_unconfirmed` requires inspecting the permanent claim, completion and evidence before any further action. No automatic retries, claim deletions or deadline extensions are permitted. The 15-second response margin bounds application waiting, not a guarantee against platform/network failure.

## Complete pilot evidence or no completion

The production prepared runner requires all 24 factors for each fixed symbol (NVDA, AMD, PLTR) before persistence. Its store independently requires 72 candidates and retains scope, unique identity, input replay, exact chronology and value/provenance conflict validation. A failed symbol prevents every evidence insert and completion. The general library's optional permissive mode remains for existing non-pilot consumers/tests; both production pilot routes call the strict prepared runner.

The durable claim is inserted before provider retrieval and remains even when no evidence is saved. This deliberately trades retry availability for protection from duplicate or ambiguous attempts. If any symbol fails, all 72 evidence rows and the completion are withheld, but that session cannot be retried. The eventual activation approval must accept this consequence. Successful evidence plus completion remain a single atomic database statement. Historical records are neither rewritten nor backfilled; availableAt is actual extraction completion.

## Release prerequisites and operator acceptance

1. Review this exact inactive code, security boundaries and tests; require safety/storage CI. This draft's release alone must not enable either switch.
2. Separately approve one session/window and the all-72/permanent-claim tradeoff. Pin the policy through reviewed source; do not let browser input or environment flags choose scope.
3. Verify prerequisites and absent session claim before the authorized pilot, then use the signed-in owner's explicit action once. No operator credential disclosure is needed.
4. After the run, independently inspect the receipt, claim, completion and 72 unique input-derived evidence identities (including legitimate identical existing rows). Check unchanged historical data and paper-only/certification safeguards. An HTTP response alone is insufficient proof of every persistence property.
5. Do not enable recurrence or exact slippage writes as part of this pilot.

Local tests include actual disabled routes, hostile origins, streamed body bounds, shared cancellation, full-budget gating, strict partial failure, and embedded PostgreSQL 72-row conflict rollback with retained claim. Embedded PostgreSQL checks are not a production transport or live concurrency test; prior independent PostgreSQL claim/conflict coverage must be retained, and runtime write verification remains part of the separately approved pilot.
