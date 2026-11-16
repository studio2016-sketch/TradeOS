-- PREPARED ONLY: additive exact-time storage. No legacy table or row is changed.
-- numeric(30,0), rather than bigint, supports the parser's years 1000..9999.
begin;
create function tradeos_evidence_epoch_ns(v text) returns numeric
language plpgsql immutable strict as $$
declare m text[]; y int; mo int; d int; h int; mi int; s int; oh int; om int; base numeric; result numeric(30,0);
begin
 m := regexp_match(v, '^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2})(?::?(\d{2}))?)$');
 if m is null then return null; end if;
 y:=m[1]::int; mo:=m[2]::int; d:=m[3]::int; h:=m[4]::int; mi:=m[5]::int; s:=m[6]::int;
 oh:=coalesce(m[10],'0')::int; om:=coalesce(m[11],'0')::int;
 if y<1000 or h>23 or mi>59 or s>59 or oh>23 or om>59 then return null; end if;
 base:=extract(epoch from make_timestamp(y,mo,d,h,mi,s));
 result := (base-(oh*3600+om*60)*case when m[9]='-' then -1 else 1 end)*1000000000
        +rpad(coalesce(m[7],''),9,'0')::numeric;
 return result;
exception when others then return null;
end $$;
create table tradeos_factor_evidence_exact (
 id bigserial primary key,
 factor_key text not null check(length(trim(factor_key))>0),
 domain text not null check(domain in ('stock','option','macro','news','portfolio')),
 subject text not null check(length(trim(subject))>0),
 value double precision not null check(value not in ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8)),
 source_name text not null check(length(trim(source_name))>0),
 observed_at_text text not null, available_at_text text not null,
 observed_ns numeric(30,0) not null, available_ns numeric(30,0) not null,
 source_metadata jsonb not null check(jsonb_typeof(source_metadata)='object'),
 check(tradeos_evidence_epoch_ns(observed_at_text) is not null and tradeos_evidence_epoch_ns(observed_at_text)=observed_ns),
 check(tradeos_evidence_epoch_ns(available_at_text) is not null and tradeos_evidence_epoch_ns(available_at_text)=available_ns),
 check(observed_ns<=available_ns),
 unique(factor_key,domain,subject,source_name,observed_ns,available_ns)
);
create index tradeos_factor_evidence_exact_decision on tradeos_factor_evidence_exact(subject,available_ns);
create function tradeos_exact_evidence_immutable() returns trigger language plpgsql as $$
begin raise exception 'exact evidence is append-only'; end $$;
create trigger tradeos_exact_evidence_protect before update or delete or truncate on tradeos_factor_evidence_exact
 for each statement execute function tradeos_exact_evidence_immutable();
commit;
