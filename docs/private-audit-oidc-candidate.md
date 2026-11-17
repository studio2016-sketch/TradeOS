# Secretless GitHub OIDC candidate (local only)

This replaces the proposed stored audit secret in the six candidate workflows with short-lived GitHub-signed job tokens. It is not deployed, activated or live-tested. The stored-secret option remains explicitly selectable server-side for compatibility; an OIDC failure never falls back to it.

## Evidence and exact trust boundary

GitHub connector identity was verified as `studio2016-sketch`. Repository metadata verified TradeOS repository ID `1409039268`, owner ID `331044643`, and creation on 2026-10-07. The connector supports repository/code/PR operations but exposes no secret/environment administration writes. A connected app is not a logged-in browser session.

The official [OIDC reference](https://docs.github.com/en/actions/reference/security/oidc) and [issuer discovery](https://token.actions.githubusercontent.com/.well-known/openid-configuration) advertise RS256, repository/owner IDs, workflow_ref, ref, event_name, runner_environment and time claims. Current GitHub documentation says repositories created after July 15, 2026 use immutable subjects. The verifier accepts the exact immutable or legacy main-branch subject, while independently pinning numeric IDs, names and ref. Custom/environment subjects are rejected, not guessed. No live Actions token has been obtained to confirm this repository's exact emitted subject.

Verification uses pinned direct dependency `jose` 6.2.5, a fixed issuer and fixed JWKS URL with 5-second timeout, caching and unknown-key refresh cooldown. The library rejects JWKS redirects. No token-supplied key/URL is trusted. RS256 signature, issuer, scalar exact audience, JWT header, expiry, issued/not-before times and maximum five-minute token age are enforced. Token lifetime may not exceed ten minutes. Provider failures deny access; no claims/errors are returned.

Only main-branch GitHub-hosted schedule/workflow_dispatch jobs from the pinned repository are admitted. Each named workflow can invoke only its corresponding fixed endpoint and scope. PR, pull_request_target, push, reusable-workflow, environment and unknown workflow contexts are rejected. The exact workflow SHA must equal the job's source SHA. Missing/changed claims fail closed.

The server must explicitly have `TRADEOS_RUNTIME_AUDIT_AUTH_MODE=github-oidc` **and** Vercel's `VERCEL_ENV=production`. Preview/development are denied even if the auth mode is copied. These are configuration gates, not secrets. Never change either gate from request input. Existing owner page/API guards remain unchanged and never accept OIDC.

## Runner behavior

Candidate workflows request only `contents: read` and `id-token: write`, use main-only job guards, and do not use a protected environment or stored audit secret. They have no PR triggers. `run-private-oidc-audit.py` uses GitHub's job-provided token request URL/token, validates the HTTPS actions.githubusercontent.com subdomain destination, requests the dedicated TradeOS audience, rejects redirects/oversize/malformed responses, and launches only the fixed audit runner/scope. Tokens stay in process memory and child environment, never command arguments, files, decoded diagnostics or logs. The child does not inherit the GitHub token-request credential. The existing runner still sends credentials only to its fixed assertion endpoint, never to anonymous boundary-check APIs.

## Risks and activation gates

- This changes trust from possession of a stored secret to authority to run the allowlisted workflow on main. Anyone able to change/execute that trusted main workflow can invoke its fixed diagnostic scope. Review repository write access and branch protection before activation. `ref_protected` is not assumed true or used as an unverifiable substitute for that review.
- OIDC is still a bearer token. A stolen valid token can be replayed within its short lifetime for the same fixed scope. This candidate has no durable one-use nonce store or distributed rate limiter. Diagnostic cache/ingestion refresh side effects can repeat; no trading or arbitrary owner APIs are enabled.
- JWKS network availability is now an authentication dependency. A GitHub outage or key mismatch fails closed. Cold starts may fetch keys separately.
- Preview gate relies on deployment environment integrity. Do not override `VERCEL_ENV` to emulate production in a shared preview.
- The source of the GitHub issuer token is verified only in mocked transport tests so far. No live token request, deployment or authenticated production probe was performed. Runtime behavior of this repository's claims and Vercel's 180-second function duration still need authorized live verification.
- Activating OIDC is a distinct trust-policy decision. Existing approval to create a stored credential is not treated as approval to activate this alternative. No Vercel settings, GitHub settings or deployment changed during implementation.

Anonymous boundary checks, assertion-only diagnostics, strict 90-second market sampling and explicit closed-market NOT RUN semantics are retained. This does not fill the browser/owner-session or manual market-smoke gaps documented in `private-audit-release-gates.md`.
