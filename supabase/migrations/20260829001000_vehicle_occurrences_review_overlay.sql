-- Human review overlay for vehicle_occurrences (Onda 3 — Review Center).
--
-- Two kinds of columns now live on this table, and they must never be
-- confused (Onda 3 §6):
--   - RAW/PARSED (source_sheet .. sale_classification): written once by the
--     migration pipeline, NEVER touched again — this is the historical
--     record as found.
--   - REVIEW OVERLAY (review_*, confirmed_*, vehicle_id, match_*,
--     reviewed_*): written by a human reviewer through the app. A
--     correction NEVER overwrites the raw value — it lives beside it.
--
-- The trigger below is the enforcement: it raises if an UPDATE touches any
-- raw/parsed column, no matter who issues it (RLS alone can't express this
-- column-level distinction).

alter table public.vehicle_occurrences
  add column review_decision text not null default 'pending' check (
    review_decision in ('pending', 'approved', 'rejected', 'edited_and_approved', 'needs_followup')
  ),
  add column review_reason text,
  add column confirmed_plate text,
  add column confirmed_brand text,
  add column confirmed_model text,
  add column confirmed_trim text,
  add column confirmed_year smallint check (confirmed_year between 1950 and 2100),
  add column confirmed_value numeric(12, 2);

comment on column public.vehicle_occurrences.review_decision is
  'Human review state. Independent of match_status (identity) — see Onda 3 report.';
comment on column public.vehicle_occurrences.confirmed_plate is
  'Human correction, kept ALONGSIDE plate_raw/plate_normalized — never overwrites them.';

create function public.vehicle_occurrences_protect_raw()
returns trigger
language plpgsql
as $$
begin
  if new.source_sheet is distinct from old.source_sheet
    or new.source_row is distinct from old.source_row
    or new.period is distinct from old.period
    or new.observed_status is distinct from old.observed_status
    or new.brand_raw is distinct from old.brand_raw
    or new.model_raw is distinct from old.model_raw
    or new.plate_raw is distinct from old.plate_raw
    or new.value_raw is distinct from old.value_raw
    or new.sale_date_raw is distinct from old.sale_date_raw
    or new.buyer_name_raw is distinct from old.buyer_name_raw
    or new.buyer_phone_raw is distinct from old.buyer_phone_raw
    or new.channel_raw is distinct from old.channel_raw
    or new.seller_raw is distinct from old.seller_raw
    or new.trade_in_raw is distinct from old.trade_in_raw
    or new.observations_raw is distinct from old.observations_raw
    or new.original_payload is distinct from old.original_payload
    or new.data_quality is distinct from old.data_quality
    or new.migration_run_id is distinct from old.migration_run_id
    or new.imported_at is distinct from old.imported_at
    or new.plate_normalized is distinct from old.plate_normalized
    or new.plate_format is distinct from old.plate_format
    or new.sale_date_parsed is distinct from old.sale_date_parsed
    or new.value_parsed is distinct from old.value_parsed
    or new.parsed_brand is distinct from old.parsed_brand
    or new.parsed_model is distinct from old.parsed_model
    or new.parsed_year is distinct from old.parsed_year
    or new.observed_status_basis is distinct from old.observed_status_basis
    or new.warnings is distinct from old.warnings
    or new.sale_classification is distinct from old.sale_classification
  then
    raise exception 'vehicle_occurrences: raw/parsed fields are immutable after import — only the review overlay (review_*, confirmed_*, vehicle_id, match_*, reviewed_*) may be updated';
  end if;
  return new;
end;
$$;

create trigger vehicle_occurrences_protect_raw
  before update on public.vehicle_occurrences
  for each row execute function public.vehicle_occurrences_protect_raw();

-- Staff may now update a row (the trigger above is what keeps it safe).
create policy "vehicle_occurrences_update_authenticated"
  on public.vehicle_occurrences for update
  to authenticated
  using (true)
  with check (true);
