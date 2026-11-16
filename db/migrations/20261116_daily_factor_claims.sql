-- PREPARED ONLY. One immutable attempt per session; failed attempts are not recycled.
begin;
create table tradeos_daily_factor_claims (
 session date primary key,
 policy text not null check(policy='tradeos.daily-factors.iex-three-symbols.v1'),
 started_at timestamptz not null, expires_at timestamptz not null,
 check(expires_at>started_at and expires_at<=started_at+interval '2 minutes')
);
create table tradeos_daily_factor_completions (
 session date primary key references tradeos_daily_factor_claims(session),
 saved integer not null check(saved between 0 and 72),
 details jsonb not null check(jsonb_typeof(details)='object')
);
create function tradeos_daily_collection_immutable() returns trigger language plpgsql as $$
begin raise exception 'daily collection records are append-only'; end $$;
create trigger tradeos_daily_claim_protect before update or delete or truncate on tradeos_daily_factor_claims
 for each statement execute function tradeos_daily_collection_immutable();
create trigger tradeos_daily_completion_protect before update or delete or truncate on tradeos_daily_factor_completions
 for each statement execute function tradeos_daily_collection_immutable();
commit;
