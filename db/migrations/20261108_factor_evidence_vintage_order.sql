-- Proposal only: apply to production only after explicit owner approval.
-- NOT VALID preserves existing immutable rows without a historical scan/rewrite.
-- New inserts/updates must respect the order even before historical validation.
alter table public.tradeos_factor_evidence
 add constraint tradeos_factor_evidence_vintage_order
 check (observed_at <= available_at) not valid;
