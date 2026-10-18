create table if not exists forecast_ledger (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  symbol text not null,
  horizon text not null,
  model_version text not null,
  regime text,
  direction text not null check (direction in ('bullish','bearish','neutral','mixed')),
  probability numeric(5,4) not null check (probability between 0 and 1),
  decision text not null check (decision in ('consider','wait','pass')),
  score numeric(6,2),
  uncertainty numeric(6,2),
  agreement numeric(6,2),
  data_quality numeric(6,2),
  evidence jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb
);

create table if not exists forecast_outcomes (
  forecast_id bigint primary key references forecast_ledger(id) on delete cascade,
  resolved_at timestamptz not null default now(),
  realized_return numeric(14,8),
  max_favorable_excursion numeric(14,8),
  max_adverse_excursion numeric(14,8),
  outcome_label text,
  was_correct boolean,
  notes text
);

create table if not exists calibration_buckets (
  id bigserial primary key,
  model_version text not null,
  horizon text not null,
  regime text,
  bucket_low numeric(5,4) not null,
  bucket_high numeric(5,4) not null,
  sample_count integer not null default 0,
  predicted_mean numeric(6,5),
  observed_frequency numeric(6,5),
  brier_score numeric(10,8),
  updated_at timestamptz not null default now(),
  unique(model_version,horizon,regime,bucket_low,bucket_high)
);

create table if not exists model_scorecards (
  id bigserial primary key,
  model_version text not null,
  strategy text not null,
  regime text,
  sample_count integer not null default 0,
  expectancy_r numeric(12,6),
  win_rate numeric(8,6),
  brier_score numeric(10,8),
  max_drawdown_r numeric(12,6),
  drift_score numeric(8,6),
  status text not null default 'observing',
  updated_at timestamptz not null default now(),
  unique(model_version,strategy,regime)
);

create table if not exists regime_snapshots (
  id bigserial primary key,
  observed_at timestamptz not null default now(),
  regime text not null,
  trend_score numeric(6,2),
  breadth_score numeric(6,2),
  volatility_score numeric(6,2),
  liquidity_score numeric(6,2),
  cross_asset_score numeric(6,2),
  raw jsonb not null default '{}'::jsonb
);

create table if not exists source_observations (
  id bigserial primary key,
  observed_at timestamptz not null default now(),
  source_id text not null,
  data_class text not null,
  symbol text,
  event_time timestamptz,
  received_at timestamptz not null default now(),
  latency_ms integer,
  freshness_score numeric(6,5),
  quality_score numeric(6,5),
  payload_hash text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists audit_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event_type text not null,
  entity_type text,
  entity_id text,
  model_version text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_forecast_symbol_created on forecast_ledger(symbol, created_at desc);
create index if not exists idx_forecast_model_created on forecast_ledger(model_version, created_at desc);
create index if not exists idx_source_observed on source_observations(source_id, observed_at desc);
create index if not exists idx_regime_observed on regime_snapshots(observed_at desc);


-- Source-grounded research decisions. Append-only enforcement is at the database layer.
-- The recorded hash provides an audit checksum, not independent proof of origin or tamper resistance.
create extension if not exists pgcrypto;
create table if not exists immutable_decision_records (
 id bigserial primary key,
 recorded_at timestamptz not null default clock_timestamp(),
 model_version text not null,
 symbol text not null,
 horizon text not null,
 prediction jsonb not null,
 observed_at timestamptz not null,
 source_type text not null,
 source_identity text not null,
 features jsonb not null,
 input_fingerprint text not null,
 model_fingerprint text not null,
 policy_status text not null default 'research_only' check(policy_status='research_only'),
 forecast_id bigint unique references forecast_ledger(id),
 created_checksum text not null,
 constraint observation_not_after_record check (observed_at<=recorded_at+interval '1 minute')
);
create or replace function tradeos_reject_decision_mutation() returns trigger language plpgsql as $$
 begin
  raise exception 'Research decision records are append-only; use separate audit or resolution records';
 end;
$$;
do $ begin
 if not exists(select 1 from pg_trigger where tgname = 'immutable_decision_records_protect' and tgrelid = 'immutable_decision_records'::regclass) then
  create trigger immutable_decision_records_protect before update or delete on immutable_decision_records
   for each row execute function tradeos_reject_decision_mutation();
 end if;
end $;
create index if not exists immutable_decision_records_by_model_time
 on immutable_decision_records(model_version,recorded_at,id);


-- Evidence-backed financial entity relationships. No inference becomes a stored fact.
create table if not exists financial_relationship_evidence (
 id bigserial primary key,
 subject_kind text not null check(subject_kind in ('company','instrument','industry','commodity','currency','economic_event')),
 subject_id text not null,
 relation text not null check(relation in ('SUPPLIES','CUSTOMER_OF','COMPETES_WITH','MEMBER_OF','EXPOSED_TO','REFERENCES')),
 object_kind text not null check(object_kind in ('company','instrument','industry','commodity','currency','economic_event')),
 object_id text not null,
 source_url text not null,
 source_name text not null,
 source_publication_at timestamptz not null,
 source_observed_at timestamptz not null,
 collected_at timestamptz not null default now(),
 evidence_excerpt text not null,
 evidence_sha256 text not null,
 verification_status text not null default 'SOURCE_RECORDED' check(verification_status in ('SOURCE_RECORDED','INDEPENDENTLY_VERIFIED')),
 check(source_publication_at<=collected_at+interval '1 minute'),
 check(source_observed_at<=collected_at+interval '1 minute')
);
create index if not exists financial_relationship_subject_idx on financial_relationship_evidence(subject_kind,subject_id);
create index if not exists financial_relationship_object_idx on financial_relationship_evidence(object_kind,object_id);
