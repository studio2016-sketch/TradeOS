-- Reviewed forward-only research investigation schema. Apply after identity and ownership are configured.
create table if not exists agent_investigations (
 id uuid primary key default gen_random_uuid(),
 hypothesis_id uuid references agent_research_hypotheses(id),
 owner_id text not null,
 status text not null default 'unverified' check(status in ('unverified','investigating','challenged','testing','certification_review','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists agent_investigations_owner_created on agent_investigations(owner_id,created_at desc);
create table if not exists agent_investigation_events (
 id bigint generated always as identity primary key,
 investigation_id uuid not null references agent_investigations(id),
 owner_id text not null,
 actor_id text not null,
 event_type text not null check(event_type in ('created','assigned','evidence_added','objection','stage_proposed','stage_reviewed')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists agent_investigation_events_ref on agent_investigation_events(investigation_id,id);
-- No API mutation privileges or approval logic are granted by this migration.
