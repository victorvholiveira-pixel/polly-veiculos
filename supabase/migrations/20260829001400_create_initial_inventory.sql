-- "Criar estoque inicial" (Onda 3 §8) — the one explicit, human-triggered
-- action that turns an APPROVED P0 candidate (a stock occurrence from the
-- most recent period) into a real vehicles row. Everything else about the
-- migration (the 602/23/263 sales, the 1.023 canonical identities, the 529
-- review-queue entries) stays exactly as dry-run data — untouched.
--
-- SECURITY DEFINER because it needs to write audit_log, which has no direct
-- INSERT policy for `authenticated` by design (see 20260829000800). Never
-- runs automatically — the frontend calls it only after an explicit confirm.
--
-- Idempotent: an occurrence already linked to a vehicle (vehicles.
-- founding_occurrence_id) is skipped on every subsequent call, so calling
-- this twice never creates duplicates — it just imports whatever is newly
-- approved since the last run.

create function public.create_initial_inventory(p_batch_label text)
returns table (created_vehicle_id uuid, source_sheet text, source_row int)
language plpgsql
security definer
as $$
declare
  v_occurrence record;
  v_vehicle_id uuid;
  v_created_ids uuid[] := '{}';
  v_count int := 0;
  v_plate_format text;
begin
  for v_occurrence in
    select o.* from public.vehicle_occurrences o
    where o.observed_status = 'stock'
      and o.review_decision in ('approved', 'edited_and_approved')
      and o.period = (select max(period) from public.vehicle_occurrences)
      and not exists (select 1 from public.vehicles v where v.founding_occurrence_id = o.id)
    order by o.source_row
  loop
    -- vehicles.plate_format only accepts old/mercosul/unknown — vehicle_occurrences'
    -- plate_format additionally has invalid/missing (finer-grained for review).
    v_plate_format := case
      when v_occurrence.plate_format in ('old', 'mercosul') then v_occurrence.plate_format
      else 'unknown'
    end;

    insert into public.vehicles (
      brand, model, trim, model_year, plate, plate_format, asking_price, origin, status, founding_occurrence_id
    )
    values (
      coalesce(v_occurrence.confirmed_brand, v_occurrence.parsed_brand, 'Não identificado'),
      coalesce(v_occurrence.confirmed_model, v_occurrence.parsed_model, 'Não identificado'),
      v_occurrence.model_raw,
      coalesce(v_occurrence.confirmed_year, v_occurrence.parsed_year),
      coalesce(v_occurrence.confirmed_plate, v_occurrence.plate_normalized),
      v_plate_format,
      coalesce(v_occurrence.confirmed_value, v_occurrence.value_parsed),
      'migration',
      'available',
      v_occurrence.id
    )
    returning id into v_vehicle_id;

    update public.vehicle_occurrences set vehicle_id = v_vehicle_id where id = v_occurrence.id;

    insert into public.audit_log (entity_type, entity_id, action, actor, diff)
    values (
      'vehicle', v_vehicle_id, 'created_from_migration', auth.uid(),
      jsonb_build_object('source_occurrence_id', v_occurrence.id, 'batch_label', p_batch_label)
    );

    v_created_ids := array_append(v_created_ids, v_vehicle_id);
    v_count := v_count + 1;

    created_vehicle_id := v_vehicle_id;
    source_sheet := v_occurrence.source_sheet;
    source_row := v_occurrence.source_row;
    return next;
  end loop;

  if v_count > 0 then
    insert into public.migration_import_batches (label, created_by, occurrence_count, vehicle_ids)
    values (p_batch_label, auth.uid(), v_count, v_created_ids);
  end if;

  return;
end;
$$;

grant execute on function public.create_initial_inventory(text) to authenticated;
