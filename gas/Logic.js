/**
 * Regras de negócio — o equivalente às antigas RPCs/triggers do Postgres.
 * Cada função aqui é o único caminho para a operação que representa; o
 * Router só faz `authenticate_` + despachar para uma destas.
 *
 * Invariantes que antes eram trigger/constraint do banco, agora garantidas
 * em código (documentado caso a caso):
 *   - "sold" só via registerSale_/cancelSale_/createInitialInventory_ —
 *     updateVehicle_ nem aceita `status` como parâmetro.
 *   - placa única entre veículos ativos — assertPlateAvailable_.
 *   - uma venda ativa por veículo — checado antes de inserir.
 *   - proveniência da migração — decideInventoryCandidate_/decideSale_ só
 *     escrevem nas colunas de overlay (confirmed_ e review_), nunca nas
 *     colunas originais (_raw/parsed_).
 */

function audit_(entityType, entityId, action, actor, diff) {
  appendRow_('AuditLog', { entity_type: entityType, entity_id: entityId, action: action, actor: actor, diff: diff });
}

function assertPlateAvailable_(plate, excludeId) {
  var vehicles = readAll_('Vehicles');
  for (var i = 0; i < vehicles.length; i++) {
    var v = vehicles[i];
    if (v.id === excludeId) continue;
    if (v.plate === plate && (v.status === 'available' || v.status === 'reserved')) {
      throw new Error('Já existe um veículo ativo com a placa ' + plate);
    }
  }
}

// ---------------------------------------------------------------- Vehicles

function fetchVehicles_(params) {
  var status = params.status || 'available';
  var rows = readAll_('Vehicles');
  if (status !== 'all') rows = rows.filter(function (v) { return v.status === status; });
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
  return rows;
}

function fetchVehicle_(params) {
  return findById_('Vehicles', params.id);
}

function createVehicle_(params, actor) {
  if (!params.brand || !params.model) throw new Error('create_vehicle: marca e modelo são obrigatórios');
  if (params.plate) assertPlateAvailable_(params.plate, null);

  var record = appendRow_('Vehicles', {
    brand: params.brand,
    model: params.model,
    trim: params.trim || null,
    model_year: params.model_year != null ? params.model_year : null,
    manufacture_year: params.manufacture_year != null ? params.manufacture_year : null,
    plate: params.plate || null,
    plate_format: params.plate_format || null,
    asking_price: params.asking_price != null ? params.asking_price : null,
    entry_date: params.entry_date || null,
    origin: 'manual',
    status: 'available',
    observations: params.observations || null,
    founding_occurrence_id: null,
  });
  audit_('vehicle', record.id, 'vehicle_created', actor, record);
  return record;
}

// Nunca recebe `status` — estruturalmente não consegue marcar como vendido.
function updateVehicle_(params, actor) {
  var before = findById_('Vehicles', params.id);
  if (!before) throw new Error('update_vehicle: veículo ' + params.id + ' não encontrado');
  if (!params.brand || !params.model) throw new Error('update_vehicle: marca e modelo são obrigatórios');
  if (params.plate && params.plate !== before.plate) assertPlateAvailable_(params.plate, params.id);

  var after = updateById_('Vehicles', params.id, {
    brand: params.brand,
    model: params.model,
    trim: params.trim || null,
    model_year: params.model_year != null ? params.model_year : null,
    manufacture_year: params.manufacture_year != null ? params.manufacture_year : null,
    plate: params.plate || null,
    plate_format: params.plate_format || null,
    asking_price: params.asking_price != null ? params.asking_price : null,
    entry_date: params.entry_date || null,
    observations: params.observations || null,
  });
  audit_('vehicle', params.id, 'vehicle_updated', actor, { before: before, after: after });
  return after;
}

// -------------------------------------------------------------------- Sales

function registerSale_(params, actor) {
  var vehicle = findById_('Vehicles', params.vehicleId);
  if (!vehicle) throw new Error('register_sale: veículo não encontrado');
  if (vehicle.status !== 'available') {
    throw new Error('register_sale: veículo não está disponível para venda (status=' + vehicle.status + ')');
  }
  if (params.saleValue == null || params.saleValue < 0) throw new Error('register_sale: valor da venda inválido');
  if (!params.saleDate) throw new Error('register_sale: informe a data da venda');

  // Segunda linha de defesa — o check de status acima já deveria impedir isso.
  var sales = readAll_('Sales');
  for (var i = 0; i < sales.length; i++) {
    if (sales[i].vehicle_id === params.vehicleId && sales[i].status === 'completed') {
      throw new Error('register_sale: já existe uma venda ativa para este veículo');
    }
  }

  var sale = appendRow_('Sales', {
    vehicle_id: params.vehicleId,
    seller_id: params.sellerId || null,
    sale_date: params.saleDate,
    customer_name: params.customerName || null,
    customer_phone: params.customerPhone || null,
    sale_value: params.saleValue,
    deal_type: params.dealType || null,
    trade_in_description: params.tradeInDescription || null,
    channel: params.channel || null,
    commission_amount: params.commissionAmount != null ? params.commissionAmount : null,
    commission_percentage: params.commissionPercentage != null ? params.commissionPercentage : null,
    commission_rule_snapshot: null,
    observations: params.observations || null,
    status: 'completed',
    cancelled_reason: null,
    cancelled_at: null,
    source_occurrence_id: null,
    created_by: actor,
  });

  updateById_('Vehicles', params.vehicleId, { status: 'sold' });
  audit_('sale', sale.id, 'sale_registered', actor, { vehicle_id: params.vehicleId, sale_value: params.saleValue, sale_date: params.saleDate });
  return sale;
}

function cancelSale_(params, actor) {
  var sale = findById_('Sales', params.saleId);
  if (!sale) throw new Error('cancel_sale: venda não encontrada');
  if (sale.status !== 'completed') throw new Error('cancel_sale: venda não está ativa (status=' + sale.status + ')');
  var reason = (params.reason || '').trim();
  if (!reason) throw new Error('cancel_sale: informe um motivo');

  // Checa o conflito de placa ANTES de escrever qualquer coisa, para nunca
  // deixar a venda cancelada com o veículo preso em 'sold' se isto falhar.
  var vehicle = findById_('Vehicles', sale.vehicle_id);
  if (vehicle && vehicle.plate) {
    var vehicles = readAll_('Vehicles');
    for (var i = 0; i < vehicles.length; i++) {
      var v = vehicles[i];
      if (v.id !== vehicle.id && v.plate === vehicle.plate && (v.status === 'available' || v.status === 'reserved')) {
        throw new Error('cancel_sale: não é possível reativar este veículo — a placa já está em uso por outro veículo ativo');
      }
    }
  }

  var updatedSale = updateById_('Sales', params.saleId, {
    status: 'cancelled', cancelled_reason: reason, cancelled_at: new Date().toISOString(),
  });
  if (vehicle) updateById_('Vehicles', vehicle.id, { status: 'available' });
  audit_('sale', sale.id, 'sale_cancelled', actor, { vehicle_id: sale.vehicle_id, reason: reason });
  return updatedSale;
}

function fetchSales_() {
  var sales = readAll_('Sales');
  var vehicleMap = {};
  readAll_('Vehicles').forEach(function (v) { vehicleMap[v.id] = v; });
  var sellerMap = {};
  readAll_('Sellers').forEach(function (s) { sellerMap[s.id] = s.name; });

  var out = sales.map(function (s) {
    var v = vehicleMap[s.vehicle_id];
    return Object.assign({}, s, {
      vehicle: v ? { brand: v.brand, model: v.model, trim: v.trim, plate: v.plate } : null,
      sellerName: s.seller_id ? (sellerMap[s.seller_id] || null) : null,
    });
  });
  out.sort(function (a, b) { return (b.sale_date || '').localeCompare(a.sale_date || ''); });
  return out;
}

// ----------------------------------------------------------------- Sellers

function fetchActiveSellers_() {
  return readAll_('Sellers')
    .filter(function (s) { return s.active; })
    .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
}

function createSeller_(params) {
  if (!params.name || !params.name.trim()) throw new Error('create_seller: informe um nome');
  return appendRow_('Sellers', { name: params.name.trim(), active: true });
}

// -------------------------------------------------------------- AppSettings

function fetchAppSettings_() {
  var rows = readAll_('AppSettings');
  return rows.length > 0 ? rows[0] : null;
}

function updateDefaultCommissionPct_(params) {
  return updateById_('AppSettings', 'true', { default_commission_pct: params.pct != null ? params.pct : null });
}

// ----------------------------------------------------------------- AuditLog

function fetchAuditLog_(params) {
  var limit = params.limit || 100;
  var rows = readAll_('AuditLog');
  rows.sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
  return rows.slice(0, limit);
}

// ----------------------------------------------------------------- Dashboard

function isoDateOnly_(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1);
  if (m.length < 2) m = '0' + m;
  var d = String(date.getDate());
  if (d.length < 2) d = '0' + d;
  return y + '-' + m + '-' + d;
}

function fetchDashboardStats_(params) {
  var vehicles = readAll_('Vehicles').filter(function (v) { return v.status === 'available'; });
  var now = (params && params.now) ? new Date(params.now) : new Date();
  var thisMonthStart = isoDateOnly_(new Date(now.getFullYear(), now.getMonth(), 1));
  var thisMonthEnd = isoDateOnly_(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  var lastMonthStart = isoDateOnly_(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  var sales = readAll_('Sales').filter(function (s) {
    return s.status === 'completed' && s.sale_date >= lastMonthStart && s.sale_date < thisMonthEnd;
  });
  var thisMonthSales = sales.filter(function (s) { return s.sale_date >= thisMonthStart; });
  var lastMonthSales = sales.filter(function (s) { return s.sale_date < thisMonthStart; });
  var knownCommissions = thisMonthSales.filter(function (s) { return s.commission_amount !== null; });

  return {
    vehiclesInStock: vehicles.length,
    stockValue: vehicles.reduce(function (sum, v) { return sum + (v.asking_price || 0); }, 0),
    salesThisMonth: thisMonthSales.length,
    revenueThisMonth: thisMonthSales.reduce(function (sum, s) { return sum + s.sale_value; }, 0),
    commissionThisMonth: knownCommissions.reduce(function (sum, s) { return sum + (s.commission_amount || 0); }, 0),
    commissionThisMonthKnownCount: knownCommissions.length,
    revenueLastMonth: lastMonthSales.reduce(function (sum, s) { return sum + s.sale_value; }, 0),
  };
}

// ------------------------------------------------------- Review Center: P0

function qualityToConfidence_(quality) {
  if (quality === 'reliable') return 'high';
  if (quality === 'partially_reliable') return 'medium';
  return 'low';
}

function latestPeriod_(occurrences) {
  return occurrences.reduce(function (max, o) { return o.period > max ? o.period : max; }, occurrences[0].period);
}

function fetchInventoryCandidates_() {
  var occurrences = readAll_('VehicleOccurrences');
  if (occurrences.length === 0) return [];
  var maxPeriod = latestPeriod_(occurrences);
  var candidates = occurrences.filter(function (o) { return o.observed_status === 'stock' && o.period === maxPeriod; });
  candidates.sort(function (a, b) { return (a.source_row || 0) - (b.source_row || 0); });
  return candidates.map(function (o) {
    return {
      id: o.id,
      brand: o.confirmed_brand || o.parsed_brand,
      model: o.confirmed_model || o.parsed_model,
      trim: o.confirmed_trim || o.model_raw,
      year: o.confirmed_year != null ? o.confirmed_year : o.parsed_year,
      plate: o.confirmed_plate || o.plate_normalized,
      value: o.confirmed_value != null ? o.confirmed_value : o.value_parsed,
      sourceSheet: o.source_sheet,
      sourceRow: o.source_row,
      monthsSeen: [o.period],
      warnings: o.warnings || [],
      confidence: qualityToConfidence_(o.data_quality),
      reviewDecision: o.review_decision,
    };
  });
}

function decideInventoryCandidate_(params, actor) {
  var patch = {
    review_decision: params.decision,
    review_reason: params.reason || null,
    reviewed_by: actor,
    reviewed_at: new Date().toISOString(),
  };
  var c = params.corrections || {};
  if (c.brand !== undefined) patch.confirmed_brand = c.brand;
  if (c.model !== undefined) patch.confirmed_model = c.model;
  if (c.trim !== undefined) patch.confirmed_trim = c.trim;
  if (c.year !== undefined) patch.confirmed_year = c.year;
  if (c.plate !== undefined) patch.confirmed_plate = c.plate;
  if (c.value !== undefined) patch.confirmed_value = c.value;
  return updateById_('VehicleOccurrences', params.occurrenceId, patch);
}

function createInitialInventory_(params, actor) {
  var occurrences = readAll_('VehicleOccurrences');
  if (occurrences.length === 0) return [];
  var maxPeriod = latestPeriod_(occurrences);

  var foundingIds = {};
  readAll_('Vehicles').forEach(function (v) { if (v.founding_occurrence_id) foundingIds[v.founding_occurrence_id] = true; });

  var created = [];
  var createdVehicleIds = [];
  occurrences.forEach(function (o) {
    if (o.observed_status !== 'stock' || o.period !== maxPeriod) return;
    if (o.review_decision !== 'approved' && o.review_decision !== 'edited_and_approved') return;
    if (foundingIds[o.id]) return;

    var plateFormat = (o.plate_format === 'old' || o.plate_format === 'mercosul') ? o.plate_format : 'unknown';
    var vehicle = appendRow_('Vehicles', {
      brand: o.confirmed_brand || o.parsed_brand || 'Não identificado',
      model: o.confirmed_model || o.parsed_model || 'Não identificado',
      trim: o.model_raw || null,
      model_year: o.confirmed_year != null ? o.confirmed_year : o.parsed_year,
      manufacture_year: null,
      plate: o.confirmed_plate || o.plate_normalized || null,
      plate_format: plateFormat,
      asking_price: o.confirmed_value != null ? o.confirmed_value : o.value_parsed,
      entry_date: null,
      origin: 'migration',
      status: 'available',
      observations: null,
      founding_occurrence_id: o.id,
    });
    updateById_('VehicleOccurrences', o.id, { vehicle_id: vehicle.id });
    audit_('vehicle', vehicle.id, 'created_from_migration', actor, { source_occurrence_id: o.id, batch_label: params.batchLabel });
    createdVehicleIds.push(vehicle.id);
    created.push({ createdVehicleId: vehicle.id, sourceSheet: o.source_sheet, sourceRow: o.source_row });
  });

  if (created.length > 0) {
    appendRow_('MigrationImportBatches', {
      label: params.batchLabel, created_by: actor, occurrence_count: created.length, vehicle_ids: createdVehicleIds,
    });
  }
  return created;
}

// ------------------------------------------------------- Review Center: P2

function fetchAmbiguousSales_() {
  var occurrences = readAll_('VehicleOccurrences').filter(function (o) { return o.sale_classification === 'sale_ambiguous'; });
  occurrences.sort(function (a, b) { return (a.period || '').localeCompare(b.period || ''); });
  return occurrences.map(function (o) {
    return {
      id: o.id,
      brand: o.confirmed_brand || o.parsed_brand,
      model: o.confirmed_model || o.parsed_model,
      plate: o.confirmed_plate || o.plate_normalized,
      value: o.confirmed_value != null ? o.confirmed_value : o.value_parsed,
      buyer: o.buyer_name_raw,
      period: o.period,
      sourceSheet: o.source_sheet,
      sourceRow: o.source_row,
      warnings: o.warnings || [],
      reviewDecision: o.review_decision,
    };
  });
}

function decideSale_(params, actor) {
  return updateById_('VehicleOccurrences', params.occurrenceId, {
    review_decision: params.decision,
    review_reason: params.reason || null,
    reviewed_by: actor,
    reviewed_at: new Date().toISOString(),
  });
}

// --------------------------------------------------- Review Center: P1/P3

function isConflictCandidate_(c) {
  return (c.reasons_against || []).some(function (r) { return r.indexOf('conflict') !== -1; });
}

function occurrenceKeyMap_() {
  var map = {};
  readAll_('VehicleOccurrences').forEach(function (o) { map[o.source_sheet + '#' + o.source_row] = o; });
  return map;
}

function slimOccurrence_(o) {
  return {
    key: o.source_sheet + '#' + o.source_row,
    sourceSheet: o.source_sheet,
    sourceRow: o.source_row,
    period: o.period,
    brand: o.parsed_brand,
    model: o.parsed_model,
    year: o.parsed_year,
    plate: o.plate_normalized || o.plate_raw,
    value: o.value_parsed,
    buyer: o.buyer_name_raw,
    warnings: o.warnings || [],
    dataQuality: o.data_quality,
  };
}

function fetchConflicts_() {
  var occByKey = occurrenceKeyMap_();
  return readAll_('VehicleMatchCandidates')
    .filter(isConflictCandidate_)
    .map(function (c) {
      var occA = occByKey[c.occurrence_a_key];
      return {
        id: c.id,
        occurrenceA: occA ? slimOccurrence_(occA) : null,
        occurrenceBKey: c.occurrence_b_key,
        score: c.score,
        reasonsFor: c.reasons_for || [],
        reasonsAgainst: c.reasons_against || [],
        decision: c.decision,
      };
    })
    .filter(function (c) { return c.occurrenceA !== null; });
}

function fetchOtherReview_() {
  var occByKey = occurrenceKeyMap_();
  return readAll_('VehicleMatchCandidates')
    .filter(function (c) { return !isConflictCandidate_(c) && c.suggested_decision === 'candidate_review'; })
    .map(function (c) {
      var occ = occByKey[c.occurrence_a_key];
      return {
        id: c.id,
        occurrence: occ ? slimOccurrence_(occ) : null,
        score: c.score,
        reasonsFor: c.reasons_for || [],
        reasonsAgainst: c.reasons_against || [],
        decision: c.decision,
      };
    })
    .filter(function (c) { return c.occurrence !== null; });
}

function decideMatchCandidate_(params, actor) {
  return updateById_('VehicleMatchCandidates', params.candidateId, {
    decision: params.decision, decided_by: actor, decided_at: new Date().toISOString(),
  });
}

// ------------------------------------------------- Carga em lote (migração)

function bulkLoadOccurrences_(params) {
  var rows = params.rows || [];
  var existingKeys = {};
  readAll_('VehicleOccurrences').forEach(function (o) { existingKeys[o.source_sheet + '#' + o.source_row] = true; });

  var toInsert = rows.filter(function (r) {
    var key = r.source_sheet + '#' + r.source_row;
    if (existingKeys[key]) return false;
    existingKeys[key] = true;
    return true;
  });
  appendRows_('VehicleOccurrences', toInsert);
  return { inserted: toInsert.length, skipped: rows.length - toInsert.length };
}

function bulkLoadMatchCandidates_(params) {
  var rows = params.rows || [];
  appendRows_('VehicleMatchCandidates', rows);
  return { inserted: rows.length };
}
