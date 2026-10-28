// Shared helpers for Pages Functions
const enc = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export function randomId() {
  return crypto.randomUUID();
}

export function randomSalt() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b));
}

// Minimal JWT (HS256) using Web Crypto
const DEFAULT_SECRET = 'change-me-in-production-set-JWT_SECRET-env';

export async function signJwt(payload, secret = DEFAULT_SECRET) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = b64(header) + '.' + b64({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 });
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return data + '.' + sigB64;
}

export async function verifyJwt(token, secret = DEFAULT_SECRET) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('HMAC', key, sig, enc.encode(h + '.' + p));
  if (!ok) return null;
  try {
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getBearer(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function requireUser(request, env) {
  const token = getBearer(request);
  const secret = (env && env.JWT_SECRET) || DEFAULT_SECRET;
  const payload = await verifyJwt(token, secret);
  if (!payload || !payload.sub) return null;
  const row = await env.DB.prepare('SELECT id, email, company_id, role FROM users WHERE id = ?').bind(payload.sub).first();
  return row || null;
}