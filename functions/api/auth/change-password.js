import { json, err, hashPassword, randomSalt, signJwt, requireUser } from '../../_utils.js';

/*
  POST /api/auth/change-password  { currentPassword, newPassword }
  - ต้องล็อกอินอยู่
  - คืน token ใหม่ให้ client เก็บแทน (token เก่าจะใช้ไม่ได้เพราะ token_version)
*/
export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const currentPassword = body.currentPassword || '';
  const newPassword = body.newPassword || '';

  if (!currentPassword) return err('กรุณากรอกรหัสผ่านเดิม', 400);
  if (!newPassword || newPassword.length < 6) return err('รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร', 400);

  const row = await env.DB.prepare('SELECT password_hash, salt FROM users WHERE id = ?').bind(user.id).first();
  if (!row) return err('Unauthorized', 401);

  const check = await hashPassword(currentPassword, row.salt);
  if (check !== row.password_hash) return err('รหัสผ่านเดิมไม่ถูกต้อง', 400);

  const salt = randomSalt();
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, salt = ?, token_version = token_version + 1 WHERE id = ?'
  ).bind(hash, salt, user.id).run();

  const fresh = await env.DB.prepare('SELECT token_version FROM users WHERE id = ?').bind(user.id).first();
  const secret = env.JWT_SECRET || 'change-me-in-production-set-JWT_SECRET-env';
  const token = await signJwt({ sub: user.id, company: user.company_id, email: user.email, ver: fresh ? fresh.token_version : 1 }, secret);

  return json({ ok: true, token, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
}
