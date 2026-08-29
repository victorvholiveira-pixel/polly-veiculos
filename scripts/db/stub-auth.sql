-- Minimal stub of what a real Supabase project provides out of the box
-- (auth schema, auth.uid(), the anon/authenticated/service_role roles),
-- ONLY so supabase/migrations/*.sql — which reference auth.users / auth.uid() —
-- can be validated against a plain local Postgres engine (no Docker required).
--
-- This file is NOT one of the approved migrations and must never be applied
-- to a real Supabase project (which already provides all of this).
-- Used exclusively by scripts/db/validate-migrations.sh.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
