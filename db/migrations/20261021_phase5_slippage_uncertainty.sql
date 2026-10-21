-- Phase 5: preserve conservative empirical slippage uncertainty explicitly.
alter table tradeos_fill_slippage_validations
 add column if not exists upper95_slippage_bps double precision,
 add column if not exists conservative_roundtrip_slippage_fraction double precision;
