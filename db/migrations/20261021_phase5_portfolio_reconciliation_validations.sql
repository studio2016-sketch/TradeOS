-- Phase 5: append-only aggregate portfolio reconciliation validation snapshots.
create table if not exists tradeos_portfolio_reconciliation_validations (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default clock_timestamp(),
 environment text not null check(environment in ('paper','live')),
 snapshot_status text not null,
 history_complete boolean not null default false,
 transaction_lineage_complete boolean not null default false,
 cash_identity_validated boolean not null default false,
 positions_identity_validated boolean not null default false,
 orders_fills_identity_validated boolean not null default false,
 corporate_actions_validated boolean not null default false,
 portfolio_reconciled boolean not null default false,
 details jsonb not null default '{}'::jsonb
);
drop trigger if exists tradeos_portfolio_reconciliation_validations_protect on tradeos_portfolio_reconciliation_validations;
create trigger tradeos_portfolio_reconciliation_validations_protect
 before update or delete on tradeos_portfolio_reconciliation_validations
 for each row execute function tradeos_reject_decision_mutation();
