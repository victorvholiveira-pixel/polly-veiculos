-- Extensions and shared helpers used by every table below.

create extension if not exists pgcrypto;  -- gen_random_uuid()
create extension if not exists pg_trgm;   -- trigram index for instant search on vehicles

-- Shared trigger: keeps `updated_at` correct without relying on the app to set it.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger: stamps updated_at = now() on every row update.';
