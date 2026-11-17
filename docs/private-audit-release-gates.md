# Private audit release gates

This is an activation checklist, not evidence of deployment or live verification.

## OIDC alternative (current local candidate)

See `private-audit-oidc-candidate.md` for the implemented alternative and its risks. It requires no saved GitHub secret or protected GitHub environment. After distinct approval, enable exactly `TRADEOS_RUNTIME_AUDIT_AUTH_MODE=github-oidc` for production only; the verifier also requires `VERCEL_ENV=production`. Review main-branch write access/protection and the six exact workflow identities with job `id-token: write`. Verify actual issued claims and fixed-scope behavior in an authorized run. Tokens remain replayable within their short accepted lifetime. Publishing code is not activation.

## Optional legacy stored-secret configuration

The following steps apply only if retaining the static-token alternative, not to OIDC. Configuration and release are separate.

1. Establish access to the existing repository-owner GitHub account. Do not create a new account to work around an identity mismatch.
2. Create the protected `tradeos-runtime-audit` environment with a main-only branch policy. Verify that public pull-request code cannot consume its secret. Review who can change environment policy and workflows.
3. Generate a fresh random 32-byte lowercase hex capability. Store the capability only as the environment secret `TRADEOS_RUNTIME_AUDIT_TOKEN`; store its SHA-256 only as the intended Vercel environment's `TRADEOS_RUNTIME_AUDIT_TOKEN_SHA256`. Never log or commit the capability. Do not reuse owner sessions, cron secrets, or provider credentials.
4. Verify the GitHub secret name and environment restrictions without reading its value. Verify the Vercel key, target and hash match without exposing values in output. If only one side can be configured, record the partial state explicitly; do not claim activation.
5. Configuration alone does not deploy the handlers or workflows. Keep code publication, merge, deployment and workflow execution as separate, authorized steps. Verify support for the 180-second market-audit duration before deployment.
6. After an authorized deployment, verify anonymous denial and fixed-scope capability behavior. Do not test the capability against arbitrary hosts, redirects, owner APIs or mutation routes. The fixed diagnostic checks may refresh provider caches and ingestion metadata. They are not trading permissions.

## Remaining workflow coverage

| Workflow | Unmigrated behavior | Safe replacement requirement |
| --- | --- | --- |
| `production-market-smoke.yml` | Anonymous AAPL/MSFT directory, AAPL/MSFT/NVDA market, AAPL/MSFT chart, AAPL historical-bars and source-audit requests; logs observation/provider details | Add a fixed server-side smoke scope retaining both directory matches and symbol-specific charts with more than one point. Report fixed assertions only. Preserve HTTP/service availability checks for all seven requests. Do not claim this is already covered by the SPY/QQQ advancement scope. |
| `production-browser-e2e.yml` | Anonymous production page access; ticker changes, chart isolation, replay load, operations labels and mobile geometry; logs API details | Use a private owner-controlled test session on an isolated database preview. Remove raw API/selector/provider logs before any authenticated run. Keep screenshots, traces, video and storage state out of public artifacts. A scoped audit token must not be turned into a page-login bypass. |
| `ios-webkit-production.yml` | Anonymous production home/live-board access; provider search and mobile layout; logs response symbols and selector contents | Preserve actual WebKit 390px touch coverage in isolated owner-session tests. Synthetic fixtures can test rendering only, not provider availability or authentication. |

Do not replace these tests with a trivial login-page assertion while retaining their old end-to-end success labels. Anonymous-denial tests are valuable but separate coverage. Do not enable an owner cookie in public Actions to make these workflows pass.

## Evidence required before calling the repair complete

- Owner sign-in, non-owner/unverified denial, expiry and back/forward behavior.
- Desktop and mobile navigation and rendering, including real iPhone/WebKit or appropriately labelled WebKit emulation.
- Fixed-scope live diagnostics, with closed-market advancement explicitly NOT RUN rather than PASS.
- Chosen trust mode verified: main/workflow OIDC identity and production-only gate, or legacy main-only protected secret access and correct Vercel hash target.
- Production privacy boundary actually deployed and independently verified. Draft PR success alone is not production protection.

Local automated tests establish code behavior with mocks. They do not establish successful credential setup, live provider access, owner login or deployment.
