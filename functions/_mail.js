// ส่งอีเมลผ่าน Resend (https://resend.com) — ตั้งค่า env: RESEND_API_KEY, MAIL_FROM
// ถ้ายังไม่ตั้งค่า จะคืน { ok:false, reason:'missing-key' } โดยไม่ทำให้ request ล้ม

export async function sendMail(env, { to, subject, html, text }) {
  const key = env && env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: 'missing-key' };

  const from = (env && env.MAIL_FROM) || 'onboarding@resend.dev';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 300); } catch {}
      return { ok: false, reason: 'provider', status: res.status, detail };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'network', detail: e && e.message };
  }
}
