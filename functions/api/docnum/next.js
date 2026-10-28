import { json, err, requireUser } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const prefix = (body.prefix || '').toUpperCase();
  const year = String(body.year || '');
  if (!prefix || !year) return err('prefix and year required');

  // atomic upsert
  const row = await env.DB.prepare('SELECT seq FROM doc_counters WHERE company_id = ? AND prefix = ? AND year = ?')
    .bind(user.company_id, prefix, year).first();
  let next = 1;
  if (row) {
    next = row.seq + 1;
    await env.DB.prepare('UPDATE doc_counters SET seq = ? WHERE company_id = ? AND prefix = ? AND year = ?')
      .bind(next, user.company_id, prefix, year).run();
  } else {
    await env.DB.prepare('INSERT INTO doc_counters (company_id, prefix, year, seq) VALUES (?, ?, ?, ?)')
      .bind(user.company_id, prefix, year, 1).run();
    next = 1;
  }
  const seq = String(next).padStart(3, '0');
  return json({ number: `${prefix}-${year}-${seq}` });
}