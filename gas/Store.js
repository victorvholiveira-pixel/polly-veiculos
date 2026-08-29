/**
 * Polly Veículos — camada de armazenamento (Google Sheets como banco).
 *
 * Cada aba é uma "tabela": a primeira linha é o cabeçalho (nomes de coluna),
 * cada linha seguinte é um registro. `readAll_`/`appendRow_`/`updateById_`
 * mapeiam linha <-> objeto JS usando esse cabeçalho, então a ordem das
 * colunas na planilha não importa — só os nomes.
 *
 * Sem transações reais (Sheets não tem). Escritas que precisam ser atômicas
 * (registrar/cancelar venda, criar veículo) são protegidas por
 * LockService.getScriptLock() em Logic.js, e cada invariante que antes era
 * uma constraint do Postgres (placa única entre veículos ativos, uma venda
 * ativa por veículo, "sold" só pelo caminho oficial) é verificada em código
 * antes de escrever — ver Logic.js.
 */

// Colunas de cada aba. JSON_COLUMNS marca quais colunas guardam um valor
// serializado como texto JSON (objeto ou array) em vez de texto/número simples.
var SHEET_COLUMNS = {
  Vehicles: [
    'id', 'brand', 'model', 'trim', 'model_year', 'manufacture_year', 'plate',
    'plate_format', 'asking_price', 'entry_date', 'origin', 'status',
    'observations', 'founding_occurrence_id', 'created_at', 'updated_at',
  ],
  Sales: [
    'id', 'vehicle_id', 'seller_id', 'sale_date', 'customer_name', 'customer_phone',
    'sale_value', 'deal_type', 'trade_in_description', 'channel', 'commission_amount',
    'commission_percentage', 'commission_rule_snapshot', 'observations', 'status',
    'cancelled_reason', 'cancelled_at', 'source_occurrence_id', 'created_by',
    'created_at', 'updated_at',
  ],
  Sellers: ['id', 'name', 'active', 'created_at', 'updated_at'],
  AppSettings: ['id', 'default_commission_pct', 'store_name', 'cnpj', 'updated_at'],
  AuditLog: ['id', 'entity_type', 'entity_id', 'action', 'actor', 'diff', 'created_at'],
  VehicleOccurrences: [
    'id', 'source_sheet', 'source_row', 'period', 'observed_status', 'brand_raw',
    'model_raw', 'plate_raw', 'value_raw', 'sale_date_raw', 'buyer_name_raw',
    'buyer_phone_raw', 'channel_raw', 'seller_raw', 'trade_in_raw', 'observations_raw',
    'original_payload', 'data_quality', 'vehicle_id', 'match_status', 'match_score',
    'migration_run_id', 'imported_at', 'reviewed_by', 'reviewed_at', 'plate_normalized',
    'plate_format', 'sale_date_parsed', 'value_parsed', 'parsed_brand', 'parsed_model',
    'parsed_year', 'observed_status_basis', 'warnings', 'sale_classification',
    'review_decision', 'review_reason', 'confirmed_plate', 'confirmed_brand',
    'confirmed_model', 'confirmed_trim', 'confirmed_year', 'confirmed_value',
  ],
  // Mirrors scripts/migration's match_candidates.json shape directly (occurrence
  // keys, not FK ids) — candidateB is very often a synthetic "veh_XXXXX:last_occurrence"
  // placeholder or another occurrence key, not a real Vehicles.id, since full
  // historical cutover hasn't happened. Forcing a Postgres-style FK here would mean
  // fabricating placeholder vehicles just to hold evidence — see ARCHITECTURE.md.
  VehicleMatchCandidates: [
    'id', 'occurrence_a_key', 'occurrence_b_key', 'tier', 'score', 'reasons_for',
    'reasons_against', 'suggested_decision', 'auto_match_allowed', 'created_at',
    'decision', 'decided_by', 'decided_at',
  ],
  MigrationImportBatches: [
    'id', 'label', 'created_by', 'created_at', 'occurrence_count', 'vehicle_ids',
  ],
};

var JSON_COLUMNS = {
  original_payload: true,
  warnings: true,
  diff: true,
  vehicle_ids: true,
  commission_rule_snapshot: true,
  reasons_for: true,
  reasons_against: true,
};

var NUMBER_COLUMNS = {
  model_year: true, manufacture_year: true, asking_price: true, sale_value: true,
  commission_amount: true, commission_percentage: true, match_score: true,
  source_row: true, value_raw: true, value_parsed: true, parsed_year: true,
  score: true, occurrence_count: true, default_commission_pct: true, tier: true,
};

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  var ss = SpreadsheetApp.create('Polly Veículos — Banco');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var columns = SHEET_COLUMNS[name];
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function serializeCell_(column, value) {
  if (value === undefined || value === null) return '';
  if (JSON_COLUMNS[column]) return JSON.stringify(value);
  return value;
}

function deserializeCell_(column, raw) {
  if (raw === '' || raw === undefined || raw === null) {
    return JSON_COLUMNS[column] ? null : null;
  }
  if (JSON_COLUMNS[column]) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  if (NUMBER_COLUMNS[column]) {
    var n = Number(raw);
    return isNaN(n) ? null : n;
  }
  if (raw instanceof Date) {
    // Sheets parses ISO-looking date/datetime strings into real Date cells —
    // convert back to the ISO string the frontend expects.
    return raw.toISOString();
  }
  return raw;
}

function rowToObject_(name, headerRow, rawRow) {
  var obj = {};
  for (var i = 0; i < headerRow.length; i++) {
    obj[headerRow[i]] = deserializeCell_(headerRow[i], rawRow[i]);
  }
  return obj;
}

/** Lê todas as linhas de uma aba como array de objetos (cabeçalho -> chave). */
function readAll_(name) {
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, headerRow.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    out.push(rowToObject_(name, headerRow, values[i]));
  }
  return out;
}

function findById_(name, id) {
  var rows = readAll_(name);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) return rows[i];
  }
  return null;
}

/** Anexa uma linha nova. Preenche id/created_at/updated_at se ausentes. */
function appendRow_(name, obj) {
  var columns = SHEET_COLUMNS[name];
  var now = new Date().toISOString();
  var record = Object.assign({}, obj);
  if (!record.id) record.id = Utilities.getUuid();
  if (columns.indexOf('created_at') !== -1 && !record.created_at) record.created_at = now;
  if (columns.indexOf('updated_at') !== -1 && !record.updated_at) record.updated_at = now;

  var sheet = getSheet_(name);
  var row = columns.map(function (col) { return serializeCell_(col, record[col]); });
  sheet.appendRow(row);
  return record;
}

/**
 * Anexa várias linhas de uma vez (uma escrita no Sheets em vez de N) — usado
 * pela carga em lote da migração (bulkLoadOccurrences_/bulkLoadMatchCandidates_),
 * que pode inserir centenas de linhas por chamada.
 */
function appendRows_(name, objs) {
  if (objs.length === 0) return;
  var columns = SHEET_COLUMNS[name];
  var now = new Date().toISOString();
  var sheet = getSheet_(name);
  var startRow = sheet.getLastRow() + 1;
  var values = objs.map(function (obj) {
    var record = Object.assign({}, obj);
    if (!record.id) record.id = Utilities.getUuid();
    if (columns.indexOf('created_at') !== -1 && !record.created_at) record.created_at = now;
    if (columns.indexOf('updated_at') !== -1 && !record.updated_at) record.updated_at = now;
    return columns.map(function (col) { return serializeCell_(col, record[col]); });
  });
  sheet.getRange(startRow, 1, values.length, columns.length).setValues(values);
}

/** Atualiza só as chaves presentes em `patch`. Nunca toca nas demais colunas. */
function updateById_(name, id, patch) {
  var sheet = getSheet_(name);
  var columns = SHEET_COLUMNS[name];
  var idCol = columns.indexOf('id') + 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error(name + ': id ' + id + ' não encontrado');

  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  var rowIndex = -1;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) { rowIndex = i + 2; break; }
  }
  if (rowIndex === -1) throw new Error(name + ': id ' + id + ' não encontrado');

  var finalPatch = Object.assign({}, patch);
  if (columns.indexOf('updated_at') !== -1) finalPatch.updated_at = new Date().toISOString();

  var currentRow = sheet.getRange(rowIndex, 1, 1, columns.length).getValues()[0];
  var current = rowToObject_(name, columns, currentRow);
  var merged = Object.assign({}, current, finalPatch);

  var newRow = columns.map(function (col) { return serializeCell_(col, merged[col]); });
  sheet.getRange(rowIndex, 1, 1, columns.length).setValues([newRow]);
  return merged;
}

/**
 * Setup manual — rode uma vez pelo editor do Apps Script (Executar > setup).
 * Idempotente: pode rodar de novo sem apagar segredos já gerados.
 * Gera duas credenciais e as imprime no log de execução (Ver > Registros):
 *   - AUTH_PASSWORD: senha para o app (pessoas fazem login com ela)
 *   - ADMIN_SECRET: só para automação/scripts (nunca digitada no app)
 */
function setup() {
  var ss = getSpreadsheet_();
  Object.keys(SHEET_COLUMNS).forEach(function (name) { getSheet_(name); });

  if (readAll_('AppSettings').length === 0) {
    appendRow_('AppSettings', { id: 'true', store_name: 'Polly Veículos' });
  }

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('AUTH_TOKEN_SECRET')) {
    props.setProperty('AUTH_TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  }
  if (!props.getProperty('AUTH_PASSWORD_HASH')) {
    var password = Utilities.getUuid().split('-')[0];
    props.setProperty('AUTH_PASSWORD_HASH', hashSecret_(password));
    Logger.log('Senha de login gerada (guarde — não é mostrada de novo): ' + password);
  }
  if (!props.getProperty('ADMIN_SECRET')) {
    var adminSecret = Utilities.getUuid();
    props.setProperty('ADMIN_SECRET', adminSecret);
    Logger.log('ADMIN_SECRET gerado (só para automação, não para login humano): ' + adminSecret);
  }

  Logger.log('Planilha pronta: ' + ss.getUrl());
}

/** Gera uma nova senha de login sem afetar o ADMIN_SECRET. */
function resetPassword() {
  var props = PropertiesService.getScriptProperties();
  var password = Utilities.getUuid().split('-')[0];
  props.setProperty('AUTH_PASSWORD_HASH', hashSecret_(password));
  Logger.log('Nova senha de login: ' + password);
}
