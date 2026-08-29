-- Onda 6 — fecha uma lacuna real: audit_log.sql (Onda 1) já documentava
-- "criação/edição de veículo" como operação que deveria ser auditada, mas
-- create/updateVehicle (Onda 3) gravavam direto na tabela sem nunca passar
-- por audit_log — a única forma de gravar lá é através de uma função
-- SECURITY DEFINER, e não existia uma para isso ainda.
--
-- Mantém as policies `vehicles_insert_authenticated`/`vehicles_update_authenticated`
-- como estão (não é o objetivo desta migration reabrir esse assunto) — a app
-- passa a usar exclusivamente estas RPCs, mas o caminho direto continua
-- tecnicamente possível para quem acessar a tabela fora do app. Ver
-- ROADMAP.md para o possível endurecimento futuro (remover essas policies e
-- forçar toda escrita em vehicles por RPC, como já acontece com sales).

create function public.create_vehicle(
  p_brand text,
  p_model text,
  p_trim text default null,
  p_model_year int default null,
  p_manufacture_year int default null,
  p_plate text default null,
  p_plate_format text default null,
  p_asking_price numeric default null,
  p_entry_date date default null,
  p_observations text default null
)
returns public.vehicles
language plpgsql
security definer
as $$
declare
  v_vehicle public.vehicles;
begin
  insert into public.vehicles (
    brand, model, trim, model_year, manufacture_year, plate, plate_format,
    asking_price, entry_date, origin, status, observations
  ) values (
    p_brand, p_model, p_trim, p_model_year, p_manufacture_year, p_plate, p_plate_format,
    p_asking_price, p_entry_date, 'manual', 'available', p_observations
  )
  returning * into v_vehicle;

  insert into public.audit_log (entity_type, entity_id, action, actor, diff)
  values ('vehicle', v_vehicle.id, 'vehicle_created', auth.uid(), to_jsonb(v_vehicle));

  return v_vehicle;
end;
$$;

grant execute on function public.create_vehicle(
  text, text, text, int, int, text, text, numeric, date, text
) to authenticated;

-- update_vehicle never takes a `status` parameter — structurally cannot
-- change it, on top of the vehicles_guard_sold_transition trigger already
-- blocking a transition to 'sold' regardless of caller.
create function public.update_vehicle(
  p_id uuid,
  p_brand text,
  p_model text,
  p_trim text default null,
  p_model_year int default null,
  p_manufacture_year int default null,
  p_plate text default null,
  p_plate_format text default null,
  p_asking_price numeric default null,
  p_entry_date date default null,
  p_observations text default null
)
returns public.vehicles
language plpgsql
security definer
as $$
declare
  v_before public.vehicles;
  v_after public.vehicles;
begin
  select * into v_before from public.vehicles where id = p_id;
  if not found then
    raise exception 'update_vehicle: vehicle % not found', p_id;
  end if;

  update public.vehicles set
    brand = p_brand,
    model = p_model,
    trim = p_trim,
    model_year = p_model_year,
    manufacture_year = p_manufacture_year,
    plate = p_plate,
    plate_format = p_plate_format,
    asking_price = p_asking_price,
    entry_date = p_entry_date,
    observations = p_observations
  where id = p_id
  returning * into v_after;

  insert into public.audit_log (entity_type, entity_id, action, actor, diff)
  values ('vehicle', p_id, 'vehicle_updated', auth.uid(), jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after)));

  return v_after;
end;
$$;

grant execute on function public.update_vehicle(
  uuid, text, text, text, int, int, text, text, numeric, date, text
) to authenticated;
