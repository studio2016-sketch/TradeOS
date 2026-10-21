-- Phase 5: separate quoted-spread-only returns from returns after all modeled costs.
alter table tradeos_execution_validation_snapshots
 add column if not exists empirical_roundtrip_slippage_fraction double precision,
 add column if not exists mean_net_after_all_modeled_costs double precision;
