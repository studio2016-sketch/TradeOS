-- Phase 5: durable, append-only execution realism snapshots.
create table if not exists tradeos_execution_validation_snapshots (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default clock_timestamp(),
 model_version text not null,
 sample_count integer not null check(sample_count>=0),
 session_count integer not null check(session_count>=0),
 mean_gross double precision,
 mean_quoted_roundtrip_spread_cost double precision,
 mean_net_after_quoted_spread double precision,
 lower_bound double precision,
 upper_bound double precision,
 modeled_cost_mature boolean not null default false,
 execution_slippage_validated boolean not null default false,
 details jsonb not null default '{}'::jsonb
);
create index if not exists tradeos_execution_validation_snapshots_model_time
 on tradeos_execution_validation_snapshots(model_version,created_at desc);
drop trigger if exists tradeos_execution_validation_snapshots_protect on tradeos_execution_validation_snapshots;
create trigger tradeos_execution_validation_snapshots_protect
 before update or delete on tradeos_execution_validation_snapshots
 for each row execute function tradeos_reject_decision_mutation();
