-- Phase 2: durable news-ingestion execution ledger.
-- Non-destructive. Records provider execution/provenance only; article content remains in existing observation payloads.
create table if not exists tradeos_news_ingestion_runs (
 id bigint generated always as identity primary key,
 provider text not null,
 endpoint text not null,
 requested_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 symbols jsonb not null default '[]'::jsonb,
 requested_limit integer not null check (requested_limit > 0),
 status text not null check (status in ('started','finished','rate_limited','failed','skipped')),
 http_status integer,
 received integer not null default 0 check (received >= 0),
 details jsonb not null default '{}'::jsonb
);
create index if not exists tradeos_news_ingestion_runs_provider_time
 on tradeos_news_ingestion_runs(provider,requested_at desc);
