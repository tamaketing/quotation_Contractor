import { json, err, hashPassword, randomId, randomSalt, signJwt, requireUser } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const companyName = (body.companyName || '').trim();
  if (!email || !password || password.length < 6) return err('Email and password (>=6 chars) required');
  if (!companyName) return err('Company name required');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return err('Email already registered', 409);

  const companyId = randomId();
  const userId = randomId();
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);

  await env.DB.prepare('INSERT INTO companies (id, name) VALUES (?, ?)').bind(companyId, companyName).run();
  await env.DB.prepare('INSERT INTO users (id, email, password_hash, salt, company_id, role) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(userId, email, hash, salt, companyId, 'owner').run();

  const secret = env.JWT_SECRET || 'change-me-in-production-set-JWT_SECRET-env';
  const token = await signJwt({ sub: userId, company: companyId, email }, secret);
  return json({ token, user: { id: userId, email, companyId, role: 'owner' } }, 201);
}