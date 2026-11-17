## Approved release window

Jermaine approved this temporary owner diagnostic release. Window: November 17, 2026, 07:50–08:05 UTC (01:50–02:05 America/Chicago, CST). The endpoint requires a full minute remaining, so start by 02:04 CST. Do not extend automatically. The operator presses once; the assistant does not invoke it. Collection remains disabled.

# Owner-session diagnostic alternative (draft only)

The approved read-only diagnostic is deployed, but Vercel's sensitive CRON_SECRET cannot be read and there is no existing execution session or suitable scheduler entry. This alternative never reads, recovers, copies or rotates that secret. The existing bearer endpoint is unchanged.

## Design

A separate POST `/api/operations/owner-data-readiness` accepts only the canonical production origin, matching Origin, browser same-origin fetch metadata, and a fixed custom request header. It rejects any body or query string. It requires the existing Neon session's user ID to exactly match TRADEOS_OWNER_USER_ID and a current database row with admin role, verified email and no ban, matching the repository's existing owner research boundary. User ID, admin status and verification are never accepted from the request.

The approval window is source-controlled, at most 15 minutes, with a full minute remaining to start. The source-controlled window is pinned to the approved times above and rejects requests outside that interval. No environment variable or URL can enable it. After expiry it automatically refuses new calls, without changing any schedule.

The page `/operations/data-readiness` makes no diagnostic request on load. A deliberate button press sends one bodyless same-origin POST. A ref blocks rapid repeat clicks; it remains disabled after success or error and never retries. The page contains no credentials or data until a successful authorized response. The owner must sign in through the existing application authentication.

Session verification is bounded at five seconds. The original 55-second deadline is passed through authentication to the existing diagnostic, and its database requests share that deadline's abort signal. Each provider call still needs its entire 12-second timeout plus three seconds of margin. The database owner verification and diagnostic queries use database-enforced read-only transactions. No claims, evidence, permissions or receipts are written.

## Scope and risks

This intentionally adds a new authorization path for the already-configured verified owner, not for arbitrary signed-in users or Vercel team members. A compromised owner session could request the diagnostic during the short window. The fixed origin and fetch metadata prevent cross-origin browser triggering; they do not replace session verification.

The browser's one-request guard is not a distributed exactly-once lock. Refreshing or using another tab can send another authorized request within the window. Guaranteeing one invocation globally would require durable coordination, which would violate this design's no-persistent-writes boundary. The operator must perform the single approved action and inspect the result; do not retry an ambiguous outcome. At most three requests occur per invocation, not per account/window globally. If strict global single-use enforcement is required, do not release this design without a separately reviewed persistent control mechanism.

An auth session call could have normal auth-provider session bookkeeping; the new application SQL is read-only. The owner database role may retain broad existing privileges; this diagnostic checks permissions, it does not reduce grants. Invalid configuration/session/provider/DB errors return sanitized responses. Readiness does not certify science, enable collection, or permit trading.

## Required next steps

1. Independently review the new owner authorization and request guards, deadline propagation, browser behavior and explicit lack of a global single-use lock.
2. Obtain release authorization and pin a <=15-minute source-controlled window suitable for the owner's availability. Recheck exact-head CI. Do not change exactSlippageWrites=false or dailyInvocation=null.
3. Deploy only that reviewed release. Have the owner sign in at the canonical production site, open the diagnostic page and press once during the window. No secret needs to be sent to an assistant or another person.
4. Inspect the actual runtime role/storage preflights and three raw-history results. An unsuccessful or ambiguous call does not authorize a repeat or collection activation. The window closes automatically. A later cleanup may remove the temporary page/route.

Only the approved temporary diagnostic release is authorized. No assistant diagnostic invocation, schedule change, credential change or collection activation is authorized. Branch deployment remains explicitly disabled.
