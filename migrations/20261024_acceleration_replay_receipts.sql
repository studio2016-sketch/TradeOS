-- Apply before deploying replay receipt instrumentation.
create table if not exists tradeos_acceleration_replay_receipts (
 id bigserial primary key,
 run_id uuid not null,
 executed_at timestamptz not null default now(),
 status text not null,
 batch integer,
 universe_count integer,
 selected_symbols text[] not null default '{}',
 attempted_trials integer not null default 0,
 inserted_trials integer not null default 0,
 historical_bars integer not null default 0,
 skipped_symbols text[] not null default '{}',
 errors jsonb not null default '[]'::jsonb,
 constraint replay_receipt_counts_valid check (inserted_trials <= attempted_trials and attempted_trials >= 0)
);
create index if not exists replay_receipts_executed_at_idx on tradeos_acceleration_replay_receipts(executed_at desc);
