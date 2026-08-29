-- Behavioral checks for the approved FASE 0.5 schema: constraints, unique
-- indexes and RLS policies. Everything runs inside one transaction that is
-- always rolled back at the end, so this file can be re-run freely against
-- the same database without leaving residue.
--
-- Each check is a DO block with its own EXCEPTION handler, so an *expected*
-- failure (e.g. a constraint correctly rejecting bad data) never aborts the
-- surrounding transaction — only an *unexpected* outcome does, via RAISE
-- EXCEPTION, which fails this whole script (and scripts/db/validate-migrations.sh).

begin;

do $$
declare
  v_seller uuid;
  v_vehicle uuid;
  v_uid uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into auth.users (id) values (v_uid) on conflict (id) do nothing;
  insert into sellers (name) values ('Assertions Seller') returning id into v_seller;
  insert into vehicles (brand, model) values ('Assertions', 'Model') returning id into v_vehicle;

  -- 1) sale_value must be >= 0
  begin
    insert into sales (vehicle_id, sale_date, sale_value) values (v_vehicle, now(), -1);
    raise exception 'FAIL: negative sale_value was accepted';
  exception when check_violation then
    raise notice 'PASS: sale_value >= 0 enforced';
  end;

  -- 2) a cancelled sale requires cancelled_reason + cancelled_at
  begin
    insert into sales (vehicle_id, sale_date, sale_value, status) values (v_vehicle, now(), 1000, 'cancelled');
    raise exception 'FAIL: cancelled sale without reason/timestamp was accepted';
  exception when check_violation then
    raise notice 'PASS: cancelled sale requires reason + cancelled_at';
  end;

  -- 3) only one *active* sale per vehicle
  insert into sales (vehicle_id, sale_date, sale_value, status) values (v_vehicle, now(), 50000, 'completed');
  begin
    insert into sales (vehicle_id, sale_date, sale_value, status) values (v_vehicle, now(), 60000, 'completed');
    raise exception 'FAIL: a second active sale for the same vehicle was accepted';
  exception when unique_violation then
    raise notice 'PASS: sales_one_active_per_vehicle_uk enforced';
  end;

  -- 4) only one *active* vehicle per plate
  insert into vehicles (brand, model, plate, status) values ('A', 'B', 'ZZZ9999', 'available');
  begin
    insert into vehicles (brand, model, plate, status) values ('C', 'D', 'ZZZ9999', 'available');
    raise exception 'FAIL: two active vehicles with the same plate were accepted';
  exception when unique_violation then
    raise notice 'PASS: vehicles_active_plate_uk enforced';
  end;

  -- 5) once the first is sold, the plate is free again for an active vehicle
  update vehicles set status = 'sold' where plate = 'ZZZ9999';
  insert into vehicles (brand, model, plate, status) values ('C', 'D', 'ZZZ9999', 'available');
  raise notice 'PASS: plate reusable once the prior vehicle is sold';

  -- 6) (source_sheet, source_row) is a unique natural key
  insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id)
    values ('ASSERT', 1, '2025-01-01', 'stock', '{}', 'reliable', gen_random_uuid());
  begin
    insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id)
      values ('ASSERT', 1, '2025-01-01', 'sold', '{}', 'reliable', gen_random_uuid());
    raise exception 'FAIL: duplicate (source_sheet, source_row) was accepted';
  exception when unique_violation then
    raise notice 'PASS: vehicle_occurrences natural key enforced';
  end;

  -- 7) RLS: anon cannot see any row (no policy grants it access)
  perform set_config('role', 'anon', true);
  if (select count(*) from vehicles) <> 0 then
    raise exception 'FAIL: anon could read vehicles';
  end if;
  raise notice 'PASS: anon has zero visibility on vehicles';
  perform set_config('role', 'authenticated', true);

  -- 8) RLS: authenticated can select and insert vehicles
  if (select count(*) from vehicles) = 0 then
    raise exception 'FAIL: authenticated could not read vehicles';
  end if;
  insert into vehicles (brand, model) values ('RLS', 'Insert-check');
  raise notice 'PASS: authenticated can select/insert vehicles';

  -- 9) RLS: authenticated CANNOT write sales directly (must go through a future
  --     SECURITY DEFINER RPC — see ARCHITECTURE.md)
  begin
    insert into sales (vehicle_id, sale_date, sale_value) select id, now(), 1 from vehicles limit 1;
    raise exception 'FAIL: authenticated inserted into sales directly';
  exception when insufficient_privilege then
    raise notice 'PASS: sales has no direct write policy for authenticated';
  end;

  -- 10) RLS: authenticated CANNOT write vehicle_occurrences (migration-pipeline only)
  begin
    insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id)
      values ('RLS-CHECK', 999, '2025-01-01', 'stock', '{}', 'reliable', gen_random_uuid());
    raise exception 'FAIL: authenticated inserted into vehicle_occurrences directly';
  exception when insufficient_privilege then
    raise notice 'PASS: vehicle_occurrences has no direct write policy for authenticated';
  end;

  -- 11) RLS: authenticated CANNOT write audit_log directly
  begin
    insert into audit_log (entity_type, entity_id, action) values ('vehicle', v_vehicle, 'created');
    raise exception 'FAIL: authenticated inserted into audit_log directly';
  exception when insufficient_privilege then
    raise notice 'PASS: audit_log has no direct write policy for authenticated';
  end;

  perform set_config('role', 'postgres', true);
  raise notice '=== ALL ASSERTIONS PASSED ===';
end
$$;

rollback;
