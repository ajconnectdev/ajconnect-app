const crypto = require('crypto');

// ── State-Signierung (verhindert, dass jemand mandant_id im OAuth-Callback faelscht) ──
function signState(mandantId, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(mandantId).digest('hex');
  return `${mandantId}.${hmac}`;
}

function verifyState(state, secret) {
  if (!state || !state.includes('.')) return null;
  const idx = state.lastIndexOf('.');
  const mandantId = state.slice(0, idx);
  const hmac = state.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret).update(mandantId).digest('hex');
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return mandantId;
}

// ── Meta signed_request parsen (fuer deauthorize / data-deletion Callbacks) ──
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function parseSignedRequest(signedRequest, secret) {
  const [encodedSig, payload] = signedRequest.split('.');
  const sig = base64UrlDecode(encodedSig);
  const data = JSON.parse(base64UrlDecode(payload).toString('utf8'));
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest();
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
    throw new Error('Ungueltige Signatur');
  }
  return data;
}

// ── Supabase REST Helper (mit Service Role Key, umgeht RLS serverseitig) ──
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

function supabaseUrl(path) {
  return `${process.env.SUPABASE_URL}/rest/v1/${path}`;
}

module.exports = { signState, verifyState, parseSignedRequest, supabaseHeaders, supabaseUrl };
