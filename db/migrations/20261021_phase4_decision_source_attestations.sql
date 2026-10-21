-- Phase 4: append-only attestation from an immutable decision to the stored source observation it used.
create table if not exists tradeos_decision_source_attestations (
 id bigint generated always as identity primary key,
 immutable_decision_id bigint not null unique references immutable_decision_records(id),
 source_observation_id bigint not null references source_observations(id),
 attested_at timestamptz not null default clock_timestamp(),
 match_method text not null check(match_method in ('direct_at_creation','symbol_source_time_within_1s')),
 time_distance_ms numeric not null check(time_distance_ms>=0 and time_distance_ms<=1000),
 source_payload_hash text,
 backfilled boolean not null default false
);
create index if not exists tradeos_decision_source_attestations_source
 on tradeos_decision_source_attestations(source_observation_id);
drop trigger if exists tradeos_decision_source_attestations_protect on tradeos_decision_source_attestations;
create trigger tradeos_decision_source_attestations_protect
 before update or delete on tradeos_decision_source_attestations
 for each row execute function tradeos_reject_decision_mutation();
