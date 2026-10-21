-- Phase 2: idempotency for hashed source observations.
create unique index if not exists source_observations_idempotent_hashed
 on source_observations(source_id,data_class,coalesce(symbol,''),event_time,payload_hash)
 where payload_hash is not null;
