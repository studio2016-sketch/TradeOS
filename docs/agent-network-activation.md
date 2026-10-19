# TradeOS Agent Network: production activation checklist

Status: foundation deployed; production hypothesis ledger migration has NOT been applied.

## Authorization boundary
Do not expose a public create/update/read endpoint for private hypotheses until authenticated user identity, record ownership, and server-side authorization are implemented and tested. A public schema readiness probe must not return private records. Read-only community sources remain untrusted and cannot publish to models.

## Controlled activation
1. Apply reviewed db/migrations/20261019_agent_research_hypotheses.sql through the approved production migration process. Preserve a rollback plan.
2. Add an identity provider or existing verified TradeOS session and require user authorization on every database read/write.
3. Add record ownership and database authorization enforcement before enabling persistent inbox writes.
4. Write a source attribution and content sanitization pipeline: HTTPS source, first-seen timestamp, canonical URL, fingerprint, provenance, no remote HTML execution.
5. Implement workflow statuses: unverified → investigating → challenged → independently tested → certification review. Status changes must be append-only audit events.
6. Add controlled, bounded investigation jobs with explicit budgets, timeouts, isolation, and retry/dead-letter behavior.
7. Run adversarial prompt-injection and unsupported-claim tests before connecting Moltbook or other communities.
8. Validate research on untouched point-in-time samples and prospective paper observations; no autonomous model promotion or brokerage orders.

## User-visible rules
Research backlog and agent role counts describe software inventory, not active autonomous agents.
The 50/50 target is development priority, not a quantified quality guarantee.
Missing sources, uncertain market coverage, and certification gaps must be visible.
