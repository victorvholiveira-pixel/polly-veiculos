-- Onda 4 — the only legitimate path to vehicles.status = 'sold'. Everything
-- the vehicles_guard_sold_transition trigger (20260829001200) anticipated:
-- this RPC does exactly what its own comment predicted — set_config the
-- session-local opt-in immediately before its own UPDATE — so no schema
-- change was needed to build it.
--
-- SECURITY DEFINER because it writes `sales` and `audit_log`, neither of
-- which has a direct INSERT policy for `authenticated` by design (writes
-- must go through this atomic, validated path — see sales.sql's header).
--
-- `select ... for update` locks the vehicle row for the duration of the
-- call, so two concurrent sale attempts on the same vehicle serialize
-- instead of racing; sales_one_active_per_vehicle_uk is the second line of
-- defense if that ever changes.

create function public.register_sale(
  p_vehicle_id uuid,
  p_sale_date date,
  p_sale_value numeric,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_seller_id uuid default null,
  p_deal_type text default null,
  p_trade_in_description text default null,
  p_channel text default null,
  p_commission_amount numeric default null,
  p_commission_percentage numeric default null,
  p_observations text default null
)
returns public.sales
language plpgsql
security definer
as $$
declare
  v_vehicle_status text;
  v_sale public.sales;
begin
  select status into v_vehicle_status from public.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'register_sale: vehicle % not found', p_vehicle_id;
  end if;
  if v_vehicle_status <> 'available' then
    raise exception 'register_sale: vehicle is not available for sale (status=%)', v_vehicle_status;
  end if;
  if p_sale_value < 0 then
    raise exception 'register_sale: sale_value must not be negative';
  end if;

  insert into public.sales (
    vehicle_id, seller_id, sale_date, customer_name, customer_phone, sale_value,
    deal_type, trade_in_description, channel, commission_amount, commission_percentage,
    observations, created_by
  ) values (
    p_vehicle_id, p_seller_id, p_sale_date, p_customer_name, p_customer_phone, p_sale_value,
    p_deal_type, p_trade_in_description, p_channel, p_commission_amount, p_commission_percentage,
    p_observations, auth.uid()
  )
  returning * into v_sale;

  perform set_config('app.allow_sold_transition', 'true', true);
  update public.vehicles set status = 'sold' where id = p_vehicle_id;
  perform set_config('app.allow_sold_transition', 'false', true);

  insert into public.audit_log (entity_type, entity_id, action, actor, diff)
  values (
    'sale', v_sale.id, 'sale_registered', auth.uid(),
    jsonb_build_object('vehicle_id', p_vehicle_id, 'sale_value', p_sale_value, 'sale_date', p_sale_date)
  );

  return v_sale;
end;
$$;

grant execute on function public.register_sale(
  uuid, date, numeric, text, text, uuid, text, text, text, numeric, numeric, text
) to authenticated;
