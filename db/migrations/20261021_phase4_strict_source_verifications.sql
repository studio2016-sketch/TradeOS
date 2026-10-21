-- Phase 4: append-only strict point-in-time verification of the raw source row actually available before a forecast.
create table if not exists tradeos_decision_source_verifications (
 id bigint generated always as identity primary key,
 immutable_decision_id bigint not null unique references immutable_decision_records(id),
 source_observation_id bigint not null references source_observations(id),
 verified_at timestamptz not null default clock_timestamp(),
 verification_rule text not null check(verification_rule='event_and_received_before_forecast'),
 source_event_time timestamptz not null,
 source_received_at timestamptz not null,
 forecast_created_at timestamptz not null,
 source_payload_hash text,
 backfilled boolean not null default false,
 check(source_event_time<=forecast_created_at),
 check(source_received_at<=forecast_created_at)
);
create index if not exists tradeos_decision_source_verifications_source
 on tradeos_decision_source_verifications(source_observation_id);
drop trigger if exists tradeos_decision_source_verifications_protect on tradeos_decision_source_verifications;
create trigger tradeos_decision_source_verifications_protect
 before update or delete on tradeos_decision_source_verifications
 for each row execute function tradeos_reject_decision_mutation();
