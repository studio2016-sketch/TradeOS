-- Phase 4: preserve raw research evidence as append-only audit history.
drop trigger if exists tradeos_factor_evidence_protect on tradeos_factor_evidence;
create trigger tradeos_factor_evidence_protect
 before update or delete on tradeos_factor_evidence
 for each row execute function tradeos_reject_decision_mutation();

drop trigger if exists source_observations_protect on source_observations;
create trigger source_observations_protect
 before update or delete on source_observations
 for each row execute function tradeos_reject_decision_mutation();
