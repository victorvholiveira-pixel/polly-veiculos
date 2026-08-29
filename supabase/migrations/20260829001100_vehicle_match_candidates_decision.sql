-- P1 review (plate/attribute conflicts) needs a place to record the human
-- decision on each candidate pair — "mesmo veículo" / "veículos diferentes" /
-- still pending. Never auto-resolved by the pipeline (Onda 2 §8/§9).

alter table public.vehicle_match_candidates
  add column decision text not null default 'pending' check (
    decision in ('pending', 'same_vehicle', 'different_vehicles')
  ),
  add column decided_by uuid references auth.users (id),
  add column decided_at timestamptz;

-- Same principle as vehicle_occurrences: the pipeline's original evidence
-- (score/reason/which occurrence/which candidate) is immutable — only the
-- decision fields may move.
create function public.vehicle_match_candidates_protect_evidence()
returns trigger
language plpgsql
as $$
begin
  if new.occurrence_id is distinct from old.occurrence_id
    or new.candidate_vehicle_id is distinct from old.candidate_vehicle_id
    or new.score is distinct from old.score
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
  then
    raise exception 'vehicle_match_candidates: evidence fields are immutable — only decision/decided_by/decided_at may be updated';
  end if;
  return new;
end;
$$;

create trigger vehicle_match_candidates_protect_evidence
  before update on public.vehicle_match_candidates
  for each row execute function public.vehicle_match_candidates_protect_evidence();

create policy "vehicle_match_candidates_update_authenticated"
  on public.vehicle_match_candidates for update
  to authenticated
  using (true)
  with check (true);
