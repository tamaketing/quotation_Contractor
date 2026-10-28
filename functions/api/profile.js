import { json, err, requireUser } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);
  const company = await env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(user.company_id).first();
  return json({ company });
}

export async function onRequestPut({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const fields = ['name','name_en','branch','tax_id','address','phone','email','bank_info','logo'];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (body[f] !== undefined) { sets.push(f + ' = ?'); vals.push(body[f]); }
  }
  if (sets.length === 0) return err('No fields');
  sets.push("updated_at = datetime('now')");
  vals.push(user.company_id);
  await env.DB.prepare('UPDATE companies SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
  const company = await env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(user.company_id).first();
  return json({ company });
}