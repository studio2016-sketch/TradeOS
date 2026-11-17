# Private read boundary

## Confirmed exposure before this candidate

Unauthenticated requests without cookies or credentials returned HTTP 200 from production `/api/forecasts` (50 database records), `/api/research` (40 subjects plus research aggregates), and `/api/research-certification` (research evidence and blocked certification). Account status and broker state denied with 401; artifact registry denied with 403. These denials do not prove all broker-derived information private: alignment source uses broker state and emits equity, buying power, exposure and position-count notes. No actual balances were reported or stored by this audit.

## Candidate scope

- Shared server-side, fail-closed owner authorization for 46 previously unguarded GET routes and the user-supplied scenario POST.
- Nine server-rendered page entry points require owner authorization before rendering unchanged client content. Login, password reset, verification and authentication callbacks remain reachable.
- Existing 42 guarded GET routes and all cron/token access policies remain untouched.
- Current trusted directory record must match the configured owner, admin role, verified email and unbanned (false or null) status. No cookie denies before an auth-service request. SDK errors, unavailable configuration and timeout fail closed.
- API responses are private/no-store and vary on cookies. No machine token bypass is added to formerly public read routes.
- Alignment and research-paper compose guarded handlers in process, rather than making unauthenticated internal HTTP requests or forwarding cookies to request-derived origins.

## Release limits

Local only: no deployment, provider/protection setting changes, historical mutation or trading activation. Protected preview must verify real owner login, normal and expired-session refresh, mobile navigation, all private pages, anonymous and non-owner rejection, and existing authorized cron operation before production release. Owner sessions are not established by synthetic tests. Deployment must retain existing protection and cron configuration.
