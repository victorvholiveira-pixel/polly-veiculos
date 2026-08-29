-- Onda 2 (migration pipeline) proved out exactly which normalized/parsed
-- fields a review workflow needs — the Onda 1 schema only had raw values +
-- a coarse data_quality label. This migration adds the parsed fields as an
-- additive, reversible change (no existing column altered or dropped).
--
-- These columns are populated ONLY by the migration pipeline (same as the
-- raw_* columns) — never computed client-side, never touched by the review
-- overlay added in the next migration.

alter table public.vehicle_occurrences
  add column plate_normalized text,
  add column plate_format text check (plate_format in ('old', 'mercosul', 'invalid', 'missing')),
  add column sale_date_parsed date,
  add column value_parsed numeric(12, 2),
  add column parsed_brand text,
  add column parsed_model text,
  add column parsed_year smallint check (parsed_year between 1950 and 2100),
  add column observed_status_basis text,
  add column warnings jsonb not null default '[]'::jsonb,
  add column sale_classification text check (
    sale_classification in ('sale_detected', 'sale_detected_with_invalid_date', 'sale_ambiguous')
  );

comment on column public.vehicle_occurrences.sale_classification is
  'Set only when observed_status=sold. sale_ambiguous NEVER implies a confirmed historical sale — see MIGRATION.md and the Onda 3 review workflow.';
