-- Agent research intake. Run only through reviewed database migration workflow.
create table if not exists agent_research_hypotheses (
 id uuid primary key default gen_random_uuid(),
 hypothesis text not null check(length(hypothesis) between 5 and 1000),
 source_url text not null check(length(source_url) <= 1000),
 source_kind text not null default 'manual_external',
 status text not null default 'unverified' check(status in ('unverified','under_review','rejected','validated')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 author_scope text not null default 'private',
 reviewed_at timestamptz,
 constraint agent_https_source check(source_url ~ '^https://')
);
create index if not exists agent_research_hypotheses_created_at on agent_research_hypotheses(created_at desc);
-- No autonomous promotion, execution grants, or external write permissions.
