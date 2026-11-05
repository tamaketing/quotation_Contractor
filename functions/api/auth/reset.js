import { json, err, hashPassword, randomSalt, sha256Hex, nowSec } from '../../_utils.js';
/*
  POST /api/auth/reset  { token, password }
  - ตรวจ token (เทียบ SHA-256) ว่ามีจริง ยังไม่ใช้ และยังไม่หมดอายุ
  - เปลี่ยนรหัสผ่าน + เพิ่ม token_version เพื่อให้ token ล็อกอินเก่าใช้ไม่ได้
*/
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const token = (body.token || '').trim();
  const password = body.password || '';

  if (!token) return err('ลิงก์รีเซ็ตไม่ถูกต้อง', 400);
  if (!password || password.length < 6) return err('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร', 400);

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    'SELECT user_id, expires_at, used FROM password_resets WHERE token_hash = ?'
  ).bind(tokenHash).first();

  if (!row || row.used || row.expires_at < nowSec()) {
    return err('ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่', 400);
  }

  const salt = randomSalt();
  const hash = await hashPassword(password, salt);

  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, salt = ?, token_version = token_version + 1 WHERE id = ?'
  ).bind(hash, salt, row.user_id).run();

  /* ใช้ token นี้ได้ครั้งเดียว + ปิด token อื่นที่ยังไม่ใช้ของผู้ใช้คนนี้ */
  await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?').bind(row.user_id).run();

  return json({ ok: true, message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ' });
}
