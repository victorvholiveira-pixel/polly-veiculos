-- Review-queue evidence for occurrences the migration pipeline could not
-- auto-resolve with confidence (match_status in pending_review/unresolved_no_signal
-- on vehicle_occurrences). Populated only by the migration pipeline; read by the
-- future cutover-review screen (Onda 2+) for a human to approve/reject.

create table public.vehicle_match_candidates (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.vehicle_occurrences (id),
  candidate_vehicle_id uuid not null references public.vehicles (id),
  score numeric not null,
  reason text not null,
  created_at timestamptz not null default now(),

  unique (occurrence_id, candidate_vehicle_id)
);

comment on table public.vehicle_match_candidates is
  'Candidatos plausíveis de deduplicação para ocorrências ambíguas. Nunca resolve merge sozinho — só alimenta a revisão humana no cutover.';

create index vehicle_match_candidates_occurrence_idx on public.vehicle_match_candidates (occurrence_id);

alter table public.vehicle_match_candidates enable row level security;

create policy "vehicle_match_candidates_select_authenticated"
  on public.vehicle_match_candidates for select
  to authenticated
  using (true);
