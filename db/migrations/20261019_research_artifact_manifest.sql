create table if not exists research_artifact_manifest (
 id uuid primary key default gen_random_uuid(),
 owner_id text not null,
 artifact_kind text not null check (artifact_kind in ('market_bars','simulation_dataset','report','research_evidence','decision_audit')),
 storage_tier text not null check (storage_tier in ('hot_database','warm_object','cold_archive')),
 sha256_hex text not null check (sha256_hex ~ '^[a-f0-9]{64}$'),
 byte_size bigint not null check (byte_size >= 0),
 object_key text,
 content_type text,
 source_reference text,
 created_at timestamptz not null default now(),
 constraint artifact_external_key check (storage_tier = 'hot_database' or object_key is not null),
 constraint artifact_owner_hash_unique unique(owner_id,sha256_hex)
);
create index if not exists artifact_manifest_owner_created on research_artifact_manifest(owner_id,created_at desc);
comment on table research_artifact_manifest is 'Metadata registry only; never contains access keys or public object URLs. App must authenticate and authorize every operation.';