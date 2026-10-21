-- Phase 4: enforce append-only forecast and outcome ledgers at the database layer.
drop trigger if exists forecast_ledger_protect on forecast_ledger;
create trigger forecast_ledger_protect
 before update or delete on forecast_ledger
 for each row execute function tradeos_reject_decision_mutation();

drop trigger if exists forecast_outcomes_protect on forecast_outcomes;
create trigger forecast_outcomes_protect
 before update or delete on forecast_outcomes
 for each row execute function tradeos_reject_decision_mutation();
