-- Onda 4 — cancelamento (soft: sales.status='cancelled', vehicles reverts to
-- 'available'). No opt-in GUC is needed for the vehicle update here — the
-- guard trigger only blocks transitions *into* 'sold', not out of it.
--
-- The plate-uniqueness index (vehicles_active_plate_uk) only excludes 'sold'
-- vehicles, so if this vehicle's plate has since been claimed by a newer
-- active vehicle, reactivating it here would collide — caught explicitly
-- below with a plain-language error instead of a raw constraint violation.

create function public.cancel_sale(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
as $$
declare
  v_sale public.sales;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'cancel_sale: sale % not found', p_sale_id;
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'cancel_sale: sale is not active (status=%)', v_sale.status;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'cancel_sale: a reason is required';
  end if;

  update public.sales
    set status = 'cancelled', cancelled_reason = p_reason, cancelled_at = now()
    where id = p_sale_id
    returning * into v_sale;

  begin
    update public.vehicles set status = 'available' where id = v_sale.vehicle_id;
  exception when unique_violation then
    raise exception 'cancel_sale: cannot reactivate this vehicle — its plate is currently in use by another active vehicle';
  end;

  insert into public.audit_log (entity_type, entity_id, action, actor, diff)
  values (
    'sale', v_sale.id, 'sale_cancelled', auth.uid(),
    jsonb_build_object('vehicle_id', v_sale.vehicle_id, 'reason', p_reason)
  );

  return v_sale;
end;
$$;

grant execute on function public.cancel_sale(uuid, text) to authenticated;
