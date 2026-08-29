/**
 * Roteador HTTP do Web App. Um único endpoint POST — o corpo é enviado como
 * `text/plain` (não `application/json`) de propósito: isso evita o preflight
 * CORS (OPTIONS) que o Apps Script Web App não responde de forma
 * configurável. O frontend (src/lib/api.ts) já manda assim.
 *
 * Toda ação passa por LockService.getScriptLock() — no volume esperado
 * (20-30 vendas/mês) o custo é irrelevante, e evita qualquer corrida entre
 * duas escritas simultâneas na mesma aba (Sheets não tem transação).
 */

var ADMIN_ONLY_ACTIONS = { bulkLoadOccurrences: true, bulkLoadMatchCandidates: true };

var ACTIONS = {
  fetchVehicles: fetchVehicles_,
  fetchVehicle: fetchVehicle_,
  createVehicle: createVehicle_,
  updateVehicle: updateVehicle_,
  registerSale: registerSale_,
  cancelSale: cancelSale_,
  fetchSales: fetchSales_,
  fetchActiveSellers: fetchActiveSellers_,
  createSeller: createSeller_,
  fetchAppSettings: fetchAppSettings_,
  updateDefaultCommissionPct: updateDefaultCommissionPct_,
  fetchAuditLog: fetchAuditLog_,
  fetchDashboardStats: fetchDashboardStats_,
  fetchInventoryCandidates: fetchInventoryCandidates_,
  decideInventoryCandidate: decideInventoryCandidate_,
  createInitialInventory: createInitialInventory_,
  fetchAmbiguousSales: fetchAmbiguousSales_,
  decideSale: decideSale_,
  fetchConflicts: fetchConflicts_,
  fetchOtherReview: fetchOtherReview_,
  decideMatchCandidate: decideMatchCandidate_,
  bulkLoadOccurrences: bulkLoadOccurrences_,
  bulkLoadMatchCandidates: bulkLoadMatchCandidates_,
};

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handleRequest_(params) {
  var action = params.action;

  if (action === 'login') return login_(params);

  var handler = ACTIONS[action];
  if (!handler) throw new Error('ação desconhecida: ' + action);

  var actor = authenticate_(params);
  if (ADMIN_ONLY_ACTIONS[action] && actor !== 'admin') {
    throw new Error(action + ': restrito à automação (ADMIN_SECRET)');
  }

  return handler(params, actor);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (parseError) {
    return jsonOutput_({ error: 'corpo da requisição inválido' });
  }

  try {
    lock.waitLock(30000);
  } catch (lockError) {
    return jsonOutput_({ error: 'sistema ocupado, tente de novo em instantes' });
  }

  try {
    var result = handleRequest_(params);
    return jsonOutput_({ data: result });
  } catch (err) {
    return jsonOutput_({ error: err.message || String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return jsonOutput_({ ok: true, service: 'Polly Veículos API' });
}
