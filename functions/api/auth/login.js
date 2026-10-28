import { json, err, hashPassword, signJwt } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return err('Email and password required');

  const user = await env.DB.prepare('SELECT id, email, password_hash, salt, company_id, role FROM users WHERE email = ?').bind(email).first();
  if (!user) return err('Invalid credentials', 401);

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) return err('Invalid credentials', 401);

  const secret = env.JWT_SECRET || 'change-me-in-production-set-JWT_SECRET-env';
  const token = await signJwt({ sub: user.id, company: user.company_id, email: user.email }, secret);
  return json({ token, user: { id: user.id, email: user.email, companyId: user.company_id, role: user.role } });
}