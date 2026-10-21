-- Phase 5: append-only independent timestamp certification records.
create table if not exists tradeos_source_time_certifications (
 id bigint generated always as identity primary key,
 provider text not null,
 feed text not null,
 certification_kind text not null check(certification_kind in ('exchange_authoritative_timestamp','primary_publication_timestamp')),
 certifier text not null,
 method text not null,
 evidence_reference text not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 valid_from timestamptz not null,
 valid_to timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 check(valid_to is null or valid_to>valid_from)
);
create index if not exists tradeos_source_time_certifications_lookup
 on tradeos_source_time_certifications(provider,feed,certification_kind,valid_from desc);
drop trigger if exists tradeos_source_time_certifications_protect on tradeos_source_time_certifications;
create trigger tradeos_source_time_certifications_protect
 before update or delete on tradeos_source_time_certifications
 for each row execute function tradeos_reject_decision_mutation();

create table if not exists tradeos_fill_slippage_validations (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default clock_timestamp(),
 environment text not null check(environment in ('paper','live')),
 fill_count integer not null check(fill_count>=0),
 matched_quote_count integer not null check(matched_quote_count>=0),
 session_count integer not null check(session_count>=0),
 volume_weighted_slippage_bps double precision,
 reference_feeds jsonb not null default '[]'::jsonb,
 independently_certified_reference_time boolean not null default false,
 slippage_validated boolean not null default false,
 details jsonb not null default '{}'::jsonb
);
drop trigger if exists tradeos_fill_slippage_validations_protect on tradeos_fill_slippage_validations;
create trigger tradeos_fill_slippage_validations_protect
 before update or delete on tradeos_fill_slippage_validations
 for each row execute function tradeos_reject_decision_mutation();
