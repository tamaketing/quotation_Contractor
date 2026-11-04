import { json, err, requireUser, randomId } from '../../_utils.js';
import { CUSTOMER_FIELDS, mapCustomer, pickCustomer } from '../../_customers.js';

export async function onRequestGet({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);
  const { results } = await env.DB.prepare(
    `SELECT id, name, address, tax_id, contact, phone, email, project, note, created_at, updated_at
       FROM customers WHERE company_id = ? ORDER BY updated_at DESC, name ASC`
  ).bind(user.company_id).all();
  return json({ items: (results || []).map(mapCustomer) });
}

export async function onRequestPost({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const name = String(body.name || '').trim();
  if (!name) return err('ต้องระบุชื่อลูกค้า');

  /* กันข้อมูลซ้ำ: ถ้ามีชื่อเดียวกันอยู่แล้ว ให้อัปเดตของเดิม */
  const found = await env.DB.prepare(
    'SELECT id FROM customers WHERE company_id = ? AND lower(trim(name)) = lower(?) LIMIT 1'
  ).bind(user.company_id, name).first();

  if (found) {
    const vals = pickCustomer(body);
    delete vals.name;
    const cols = Object.keys(vals);
    if (cols.length) {
      const sets = cols.map(c => c + ' = ?');
      sets.push("updated_at = datetime('now')");
      await env.DB.prepare(
        'UPDATE customers SET ' + sets.join(', ') + ' WHERE id = ? AND company_id = ?'
      ).bind(...cols.map(c => vals[c]), found.id, user.company_id).run();
    }
    const row = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?')
      .bind(found.id, user.company_id).first();
    return json({ item: mapCustomer(row), created: false });
  }

  const id = body.id || randomId();
  const vals = { name };
  const picked = pickCustomer(body);
  for (const f of CUSTOMER_FIELDS) {
    if (f.col !== 'name' && picked[f.col] !== undefined) vals[f.col] = picked[f.col];
  }
  const cols = Object.keys(vals);
  await env.DB.prepare(
    'INSERT INTO customers (id, company_id, ' + cols.join(', ') + ') VALUES (?, ?, ' + cols.map(() => '?').join(', ') + ')'
  ).bind(id, user.company_id, ...cols.map(c => vals[c])).run();

  const row = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND company_id = ?')
    .bind(id, user.company_id).first();
  return json({ item: mapCustomer(row), created: true }, 201);
}
