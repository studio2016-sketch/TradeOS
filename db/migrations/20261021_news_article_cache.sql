-- Phase 2: shared cross-instance news article cache for rate-limit-safe reuse.
create table if not exists tradeos_news_articles (
 provider text not null,
 article_id text not null,
 published_at timestamptz not null,
 ingested_at timestamptz not null default clock_timestamp(),
 headline text not null,
 symbols jsonb not null default '[]'::jsonb,
 source_name text not null,
 source_quality double precision not null,
 summary text not null default '',
 primary key(provider,article_id)
);
create index if not exists tradeos_news_articles_recent on tradeos_news_articles(provider,published_at desc);
