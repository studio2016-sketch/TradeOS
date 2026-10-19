-- TradeOS Institutional Data Plane v1. Apply with reviewed migration tooling.
-- This migration creates storage; it does not certify data or change existing trading permissions.
create table if not exists security_master (
 security_id uuid primary key default gen_random_uuid(),
 issuer_name text not null,
 asset_class text not null check (asset_class in ('equity','etf','adr','index','option','future','other')),
 primary_exchange text,
 figi text, cusip text, isin text,
 created_at timestamptz not null default clock_timestamp()
);
create table if not exists security_symbol_history (
 id bigint generated always as identity primary key,
 security_id uuid not null references security_master(security_id),
 symbol text not null, venue text not null,
 valid_from timestamptz not null, valid_to timestamptz,
 known_from timestamptz not null default clock_timestamp(),
 known_to timestamptz,
 source_reference text not null,
 check (valid_to is null or valid_to>valid_from),
 check (known_to is null or known_to>known_from)
);
create index if not exists security_symbol_history_lookup
 on security_symbol_history(symbol,venue,valid_from,known_from);
create table if not exists institutional_observations (
 observation_id uuid primary key default gen_random_uuid(),
 security_id uuid references security_master(security_id),
 symbol text not null,
 observation_type text not null,
 source_family text not null,
 source_product text not null,
 entitlement text not null,
 exchange_venue text,
 market_coverage text,
 event_time timestamptz not null,
 provider_published_at timestamptz,
 received_at timestamptz not null default clock_timestamp(),
 available_at timestamptz not null default clock_timestamp(),
 raw_sha256 text not null check (raw_sha256 ~ '^[0-9a-f]{64}$'),
 payload jsonb not null,
 validation_status text not null check(validation_status in ('unverified','verified','disputed','stale','retracted')),
 correction_of uuid references institutional_observations(observation_id),
 ingest_version text not null,
 source_reference text not null,
 created_at timestamptz not null default clock_timestamp(),
 check (event_time<=received_at+interval '1 second')
);
create index if not exists institutional_observations_replay
 on institutional_observations(symbol,event_time,available_at);
create index if not exists institutional_observations_source
 on institutional_observations(source_family,received_at);
create unique index if not exists institutional_observation_idempotency
 on institutional_observations(source_family,source_product,source_reference,raw_sha256);
create table if not exists corporate_action_vintages (
 action_id uuid primary key default gen_random_uuid(),
 security_id uuid not null references security_master(security_id),
 action_type text not null,
 effective_at timestamptz not null,
 announced_at timestamptz,
 available_at timestamptz not null,
 source_family text not null,
 source_reference text not null,
 payload jsonb not null,
 supersedes uuid references corporate_action_vintages(action_id),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists corporate_action_vintages_pit
 on corporate_action_vintages(security_id,available_at,effective_at);
-- Fail-closed historical query rule: event_time <= simulation_time AND available_at <= simulation_time.
-- Corrections are new rows, never overwrites. Apply DB grants and RLS before any write endpoint.
-- DB owner/admin can still mutate tables; cryptographic external anchoring needed for tamper evidence.
