import { json, err, requireUser } from '../../_utils.js';
import { mapCustomer, pickCustomer } from '../../_customers.js';

export async function onRequestGet({ request, env, params }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);
  const row = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?')
    .bind(params.id, user.company_id).first();
  if (!row) return err('Not found', 404);
  return json({ item: mapCustomer(row) });
}

export async function onRequestPut({ request, env, params }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const vals = pickCustomer(body);
  if (vals.name !== undefined) {
    vals.name = String(vals.name).trim();
    if (!vals.name) return err('ต้องระบุชื่อลูกค้า');
  }
  const cols = Object.keys(vals);
  if (!cols.length) return err('No fields');

  const sets = cols.map(c => c + ' = ?');
  sets.push("updated_at = datetime('now')");
  await env.DB.prepare(
    'UPDATE customers SET ' + sets.join(', ') + ' WHERE id = ? AND company_id = ?'
  ).bind(...cols.map(c => vals[c]), params.id, user.company_id).run();

  const row = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?')
    .bind(params.id, user.company_id).first();
  if (!row) return err('Not found', 404);
  return json({ item: mapCustomer(row) });
}

export async function onRequestDelete({ request, env, params }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);
  await env.DB.prepare('DELETE FROM customers WHERE id = ? AND company_id = ?')
    .bind(params.id, user.company_id).run();
  return json({ ok: true });
}
