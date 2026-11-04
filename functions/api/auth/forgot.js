import { json, err, randomToken, sha256Hex, nowSec, ensureAuthSchema } from '../../_utils.js';
import { sendMail } from '../../_mail.js';

/*
  POST /api/auth/forgot  { email }
  - ตอบข้อความกลาง ๆ เสมอ (ไม่บอกว่าอีเมลมีในระบบหรือไม่)
  - ถ้ามีผู้ใช้: สร้าง token สุ่ม เก็บเฉพาะ SHA-256 หมดอายุ 30 นาที
  - ส่งลิงก์ทางอีเมลผ่าน Resend ถ้าตั้งค่า RESEND_API_KEY ไว้
  - ถ้าไม่ได้ตั้งค่า และ AUTH_DEBUG=1 จะคืน debugLink สำหรับทดสอบ (ห้ามเปิดใน production)
*/
export async function onRequestPost({ request, env }) {
  await ensureAuthSchema(env);
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const email = (body.email || '').trim().toLowerCase();
  if (!email) return err('กรุณากรอกอีเมล', 400);

  const generic = {
    ok: true,
    message: 'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว — กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม (ลิงก์มีอายุ 30 นาที)',
  };

  /* ยังไม่ได้ตั้งค่าอีเมลและไม่ได้เปิดโหมดทดสอบ → ตอบเหมือนกันทุกอีเมล (ไม่ให้เดาว่ามีบัญชีหรือไม่) */
  if (!env.RESEND_API_KEY && env.AUTH_DEBUG !== '1') {
    return json({
      ok: true,
      delivery: 'unavailable',
      message: 'ระบบยังไม่ได้ตั้งค่าการส่งอีเมล กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน',
    });
  }

  const user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first();
  if (!user) return json(generic);

  const now = nowSec();

  /* จำกัด 3 ครั้ง / 15 นาที ต่อบัญชี */
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ? AND created_at > ?'
  ).bind(user.id, now - 900).first();
  if (recent && recent.n >= 3) {
    /* ตอบข้อความเดิม เพื่อไม่ให้เดาได้ว่าอีเมลนี้มีในระบบ */
    return json(generic);
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(tokenHash, user.id, now + 1800).run();

  /* ล้างรายการที่หมดอายุเกิน 1 วัน */
  try {
    await env.DB.prepare('DELETE FROM password_resets WHERE expires_at < ?').bind(now - 86400).run();
  } catch {}

  const origin = (env.APP_ORIGIN || new URL(request.url).origin).replace(/\/$/, '');
  const link = origin + '/reset-password.html?token=' + encodeURIComponent(token);
  const safeEmail = String(user.email).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const mail = await sendMail(env, {
    to: user.email,
    subject: 'ตั้งรหัสผ่านใหม่ — ระบบเอกสารรับเหมา',
    text:
      'มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้\n\n' +
      'เปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (อายุ 30 นาที):\n' + link + '\n\n' +
      'ถ้าคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร ลิงก์จะหมดอายุเอง',
    html:
      '<div style="font-family:Sarabun,Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">' +
      '<h2 style="color:#1a1f36;margin:0 0 12px">🔐 ตั้งรหัสผ่านใหม่</h2>' +
      '<p style="color:#374151;font-size:14px;line-height:1.7">มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี <b>' + safeEmail + '</b></p>' +
      '<p style="margin:20px 0"><a href="' + link + '" style="background:#c2410c;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;display:inline-block">ตั้งรหัสผ่านใหม่</a></p>' +
      '<p style="color:#6b7280;font-size:12.5px;line-height:1.7">ลิงก์มีอายุ 30 นาที · ถ้าคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร</p>' +
      '<p style="color:#9ca3af;font-size:11px;word-break:break-all">' + link + '</p>' +
      '</div>',
  });

  if (mail.ok) return json(generic);

  /* ยังไม่ได้ตั้งค่าวิธีส่งอีเมล */
  if (env.AUTH_DEBUG === '1') {
    return json({
      ...generic,
      delivery: 'debug',
      debugLink: link,
      message: 'โหมดทดสอบ: ยังไม่ได้ตั้งค่าอีเมล — ใช้ลิงก์ด้านล่างตั้งรหัสผ่านใหม่ได้เลย',
    });
  }

  console.error('forgot-password mail failed:', mail);
  return json({
    ok: true,
    delivery: 'unavailable',
    message: 'ระบบยังไม่ได้ตั้งค่าการส่งอีเมล กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน',
  });
}
