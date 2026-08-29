/**
 * Autenticação simples para um app pessoal (uma senha compartilhada, sem
 * cadastro de usuários) — ver ARCHITECTURE.md, seção "Auth". `name` é só
 * quem a pessoa digita para se identificar no rodapé de auditoria (ex.:
 * "Victor", "Pai"), não uma conta separada.
 *
 * Token: `base64url(JSON{name,iat,exp}) + "." + base64url(HMAC-SHA256(...))`.
 * Verificado a cada chamada — sem sessão armazenada no servidor.
 *
 * ADMIN_SECRET é uma credencial separada, só para automação (carga da
 * migração, testes) — nunca é a senha que uma pessoa digita no app.
 */

var TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function hashSecret_(value) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest);
}

function base64UrlEncodeString_(str) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(str).getBytes()).replace(/=+$/, '');
}

function base64UrlDecodeToString_(str) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(str)).getDataAsString();
}

function signToken_(payload) {
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_TOKEN_SECRET');
  if (!secret) throw new Error('auth: AUTH_TOKEN_SECRET não configurado — rode setup() primeiro');
  var payloadPart = base64UrlEncodeString_(JSON.stringify(payload));
  var signatureBytes = Utilities.computeHmacSha256Signature(payloadPart, secret);
  var signaturePart = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');
  return payloadPart + '.' + signaturePart;
}

function verifyToken_(token) {
  if (!token || token.indexOf('.') === -1) throw new Error('auth: token inválido');
  var parts = token.split('.');
  var payloadPart = parts[0];
  var signaturePart = parts[1];
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_TOKEN_SECRET');
  var expectedBytes = Utilities.computeHmacSha256Signature(payloadPart, secret);
  var expected = Utilities.base64EncodeWebSafe(expectedBytes).replace(/=+$/, '');
  if (expected !== signaturePart) throw new Error('auth: token inválido');

  var payload = JSON.parse(base64UrlDecodeToString_(payloadPart));
  if (!payload.exp || Date.now() > payload.exp) throw new Error('auth: sessão expirada, faça login de novo');
  return payload;
}

/** Ação 'login' — não passa por authenticate_ (é o único endpoint público). */
function login_(params) {
  var name = (params.name || '').trim();
  var password = params.password || '';
  if (!name) throw new Error('login: informe seu nome');

  var hash = PropertiesService.getScriptProperties().getProperty('AUTH_PASSWORD_HASH');
  if (!hash) throw new Error('login: app ainda não configurado — rode setup() no editor');
  if (hashSecret_(password) !== hash) throw new Error('login: senha incorreta');

  var now = Date.now();
  return { token: signToken_({ name: name, iat: now, exp: now + TOKEN_TTL_MS }) };
}

/**
 * Autentica a requisição: aceita um token de usuário válido OU o
 * ADMIN_SECRET (uso interno/automação). Retorna o "actor" para auditoria.
 */
function authenticate_(params) {
  var adminSecret = PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET');
  if (adminSecret && params.adminSecret === adminSecret) return 'admin';
  if (params.token) return verifyToken_(params.token).name;
  throw new Error('auth: faça login novamente');
}
