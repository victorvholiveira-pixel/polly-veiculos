-- Closes the pendency flagged in ARCHITECTURE.md since Onda 1: an
-- authenticated user could set vehicles.status = 'sold' via a plain UPDATE,
-- bypassing the (not yet built) transactional sale flow entirely.
--
-- From now on, a transition TO 'sold' is rejected unless the session has
-- explicitly opted in via `app.allow_sold_transition`. Nothing sets that
-- flag today — there is no legitimate way to reach 'sold' yet, by design
-- (Vender ships in a future onda). The future register_sale RPC will do
-- `perform set_config('app.allow_sold_transition', 'true', true)` (session-
-- local, cleared automatically) immediately before its own UPDATE, so this
-- guard requires no change when that RPC is built.

create function public.vehicles_guard_sold_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'sold'
    and old.status is distinct from 'sold'
    and coalesce(current_setting('app.allow_sold_transition', true), 'false') <> 'true'
  then
    raise exception 'vehicles: status can only become ''sold'' through the sale flow, not a direct update';
  end if;
  return new;
end;
$$;

create trigger vehicles_guard_sold_transition
  before update on public.vehicles
  for each row execute function public.vehicles_guard_sold_transition();
