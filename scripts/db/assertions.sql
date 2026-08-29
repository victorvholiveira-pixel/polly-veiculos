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
  -- (the sold transition itself needs the guard's opt-in — see check 10a/10b below)
  perform set_config('app.allow_sold_transition', 'true', true);
  update vehicles set status = 'sold' where plate = 'ZZZ9999';
  perform set_config('app.allow_sold_transition', 'false', true);
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

  -- 12) vehicles: a direct UPDATE to status='sold' is rejected without the guard opt-in
  --     (closes the Onda 1 pendency — see ARCHITECTURE.md). Uses a fresh vehicle —
  --     v_vehicle was already transitioned to sold under the guard's opt-in in check 5.
  declare
    v_guard_vehicle uuid;
  begin
    insert into vehicles (brand, model, status) values ('Guard', 'Test', 'available') returning id into v_guard_vehicle;

    begin
      update vehicles set status = 'sold' where id = v_guard_vehicle;
      raise exception 'FAIL: authenticated set status=sold via a plain UPDATE';
    exception when others then
      if sqlerrm like 'vehicles: status can only become%' then
        raise notice 'PASS: vehicles_guard_sold_transition blocks a direct sold update';
      else
        raise;
      end if;
    end;

    -- 13) the SAME transition succeeds once the guard is explicitly opted into
    --     (this is what the future register_sale RPC will do)
    perform set_config('app.allow_sold_transition', 'true', true);
    update vehicles set status = 'sold' where id = v_guard_vehicle;
    perform set_config('app.allow_sold_transition', 'false', true);
    if (select status from vehicles where id = v_guard_vehicle) <> 'sold' then
      raise exception 'FAIL: sold transition did not apply even with the guard opt-in';
    end if;
    raise notice 'PASS: sold transition succeeds with explicit opt-in (future sale RPC path)';
  end;

  -- 14) vehicle_occurrences: raw/parsed fields are immutable, review overlay is not
  declare
    v_occ uuid;
  begin
    -- Setup as the migration pipeline (postgres/service_role) would — authenticated
    -- has no INSERT policy on this table by design (check 10 above).
    perform set_config('role', 'postgres', true);
    insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id, parsed_brand)
      values ('ASSERT-REVIEW', 1, '2025-01-01', 'stock', '{}', 'reliable', gen_random_uuid(), 'Fiat')
      returning id into v_occ;
    perform set_config('role', 'authenticated', true);

    begin
      update vehicle_occurrences set parsed_brand = 'Ford' where id = v_occ;
      raise exception 'FAIL: a parsed/raw field on vehicle_occurrences was updated';
    exception when others then
      if sqlerrm like 'vehicle_occurrences: raw/parsed fields are immutable%' then
        raise notice 'PASS: vehicle_occurrences raw/parsed fields are immutable';
      else
        raise;
      end if;
    end;

    update vehicle_occurrences
      set review_decision = 'edited_and_approved', confirmed_brand = 'Fiat (confirmado)'
      where id = v_occ;
    if (select confirmed_brand from vehicle_occurrences where id = v_occ) <> 'Fiat (confirmado)' then
      raise exception 'FAIL: the review overlay itself could not be updated';
    end if;
    if (select parsed_brand from vehicle_occurrences where id = v_occ) <> 'Fiat' then
      raise exception 'FAIL: the original parsed_brand changed after a review overlay update';
    end if;
    raise notice 'PASS: review overlay update preserves the original parsed/raw values (provenance)';
  end;

  -- 15) vehicle_match_candidates: evidence fields are immutable, decision is not
  declare
    v_occ_a uuid;
    v_candidate_vehicle uuid;
    v_match uuid;
  begin
    -- Setup as the migration pipeline would (see check 14's comment).
    perform set_config('role', 'postgres', true);
    insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id)
      values ('ASSERT-MATCH', 1, '2025-01-01', 'stock', '{}', 'reliable', gen_random_uuid())
      returning id into v_occ_a;
    insert into vehicles (brand, model) values ('Candidate', 'Vehicle') returning id into v_candidate_vehicle;
    insert into vehicle_match_candidates (occurrence_id, candidate_vehicle_id, score, reason)
      values (v_occ_a, v_candidate_vehicle, 0.7, 'test evidence')
      returning id into v_match;
    perform set_config('role', 'authenticated', true);

    begin
      update vehicle_match_candidates set score = 0.99 where id = v_match;
      raise exception 'FAIL: match evidence (score) was updated';
    exception when others then
      if sqlerrm like 'vehicle_match_candidates: evidence fields are immutable%' then
        raise notice 'PASS: vehicle_match_candidates evidence fields are immutable';
      else
        raise;
      end if;
    end;

    update vehicle_match_candidates set decision = 'same_vehicle', decided_at = now() where id = v_match;
    raise notice 'PASS: vehicle_match_candidates decision field is updatable';
  end;

  -- 16) migration_import_batches: authenticated can insert/select, never delete
  insert into migration_import_batches (label, occurrence_count) values ('assert-batch', 0);
  if (select count(*) from migration_import_batches where label = 'assert-batch') <> 1 then
    raise exception 'FAIL: could not read back an inserted import batch';
  end if;
  raise notice 'PASS: migration_import_batches insert/select for authenticated works';

  -- 17) create_initial_inventory: only approved stock occurrences in the latest
  --     period become real vehicles; the call is idempotent; rejected/pending
  --     occurrences are never imported.
  declare
    v_period date := '2030-01-01'; -- distinctly later than every other test's period
    v_approved_occ uuid;
    v_rejected_occ uuid;
    v_pending_occ uuid;
    v_created_count int;
  begin
    perform set_config('role', 'postgres', true);
    insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id, parsed_brand, parsed_model, value_parsed, plate_normalized, plate_format)
      values ('ASSERT-INVENTORY', 1, v_period, 'stock', '{}', 'reliable', gen_random_uuid(), 'Fiat', 'Uno', 25900, 'ABC1234', 'old')
      returning id into v_approved_occ;
    insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id, parsed_brand)
      values ('ASSERT-INVENTORY', 2, v_period, 'stock', '{}', 'reliable', gen_random_uuid(), 'Ford')
      returning id into v_rejected_occ;
    insert into vehicle_occurrences (source_sheet, source_row, period, observed_status, original_payload, data_quality, migration_run_id, parsed_brand)
      values ('ASSERT-INVENTORY', 3, v_period, 'stock', '{}', 'reliable', gen_random_uuid(), 'Honda')
      returning id into v_pending_occ;
    perform set_config('role', 'authenticated', true);

    update vehicle_occurrences set review_decision = 'approved' where id = v_approved_occ;
    update vehicle_occurrences set review_decision = 'rejected' where id = v_rejected_occ;
    -- v_pending_occ is left at the default 'pending'.

    select count(*) into v_created_count from create_initial_inventory('assert-batch-1');
    if v_created_count <> 1 then
      raise exception 'FAIL: expected exactly 1 vehicle created (got %), rejected/pending must not be imported', v_created_count;
    end if;
    if not exists (select 1 from vehicles where founding_occurrence_id = v_approved_occ and status = 'available' and plate = 'ABC1234') then
      raise exception 'FAIL: the approved occurrence did not produce the expected vehicle';
    end if;
    if exists (select 1 from vehicles where founding_occurrence_id in (v_rejected_occ, v_pending_occ)) then
      raise exception 'FAIL: a rejected or pending occurrence was imported as inventory';
    end if;
    if not exists (select 1 from audit_log where entity_type = 'vehicle' and (diff->>'source_occurrence_id')::uuid = v_approved_occ) then
      raise exception 'FAIL: no audit_log entry for the created vehicle';
    end if;
    if not exists (select 1 from migration_import_batches where label = 'assert-batch-1' and occurrence_count = 1) then
      raise exception 'FAIL: no batch record for the import';
    end if;
    raise notice 'PASS: create_initial_inventory imports only approved candidates, with audit_log + batch record';

    -- Calling again with nothing new approved must create zero additional vehicles.
    select count(*) into v_created_count from create_initial_inventory('assert-batch-2');
    if v_created_count <> 0 then
      raise exception 'FAIL: create_initial_inventory re-run created % vehicles instead of 0 (not idempotent)', v_created_count;
    end if;
    raise notice 'PASS: create_initial_inventory is idempotent on re-run';
  end;

  perform set_config('role', 'postgres', true);
  raise notice '=== ALL ASSERTIONS PASSED ===';
end
$$;

rollback;
