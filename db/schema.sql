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
