# Audit failure diagnostics

The first production readiness run after release (44181994887) failed after obtaining an OIDC token and launching the detailed runner. One retry also failed. Independent anonymous checks of all four boundary endpoints returned 401. The previous single generic error cannot establish whether the remaining failure is authentication, transport, HTTP or schema. No cause is asserted yet.

This patch preserves every authorization predicate and response schema. Python runners print only a small fixed failure category; unknown exceptions remain generic. They never print exception text, HTTP bodies, tokens or claim values. The server records only a fixed OIDC-denial category, at most once per category per minute per process instance. This is bounded diagnostic logging, not a distributed request limiter. Public responses remain generic.

Next: deploy the diagnostic patch after approval/CI, rerun the same scoped job, inspect only safe categories, and repair the proven cause with tests. Do not loosen issuer, signature, identity, audience, workflow, branch, scope or time checks by guessing. A successful token request is not proof that the server accepted it or that market readiness passed.
